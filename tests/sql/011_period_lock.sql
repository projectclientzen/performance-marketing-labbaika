-- Proof for CC-B11 "selesai kalau" — all 4 scenarios.
-- NOTE: relies on a local-only stub auth.uid() (real Supabase provides this
-- natively) reading session var request.jwt.claim.sub, set via `set local`.

begin;

insert into brands (name, slug) values ('Labbaika Group', 'labbaika-lock-test');

do $$
declare
  v_brand uuid; v_cs uuid; v_owner uuid; v_source uuid;
  v_report uuid; v_program uuid; v_departure uuid;
begin
  select id into v_brand from brands where slug = 'labbaika-lock-test';

  insert into auth.users (id) values (gen_random_uuid()) returning id into v_cs;
  insert into auth.users (id) values (gen_random_uuid()) returning id into v_owner;

  insert into app_users (id, brand_id, full_name, role) values (v_cs, v_brand, 'Reza', 'cs');
  insert into app_users (id, brand_id, full_name, role) values (v_owner, v_brand, 'Owner', 'owner');

  insert into lead_sources (brand_id, name, slug)
    values (v_brand, 'Facebook CTWA', 'facebook-ctwa') returning id into v_source;
  insert into programs (brand_id, name, destination, duration_days)
    values (v_brand, 'Umroh Turki 16D', 'Turki', 16) returning id into v_program;
  insert into program_departures (brand_id, program_id, departure_date)
    values (v_brand, v_program, '2026-10-12') returning id into v_departure;

  insert into lead_reports (brand_id, cs_id, report_date, source_id, total_lead, cold, consultation, offering)
  values (v_brand, v_cs, '2026-08-20', v_source, 50, 25, 15, 10)
  returning id into v_report;

  -- Lock August 2026.
  insert into period_locks (brand_id, year, month, locked_by) values (v_brand, 2026, 8, v_owner);

  -- === Scenario 1: CS fails to edit August report after lock ===
  perform set_config('request.jwt.claim.sub', v_cs::text, true);
  begin
    update lead_reports set cold = 24, consultation = 16 where id = v_report;
    raise exception 'SCENARIO 1 FAILED: CS edit on locked period was accepted';
  exception
    when others then
      if sqlerrm like '%sudah dikunci%' then
        raise notice 'SCENARIO 1 PASSED: CS edit rejected (%)', sqlerrm;
      else
        raise exception 'SCENARIO 1 FAILED: wrong error: %', sqlerrm;
      end if;
  end;

  -- === Scenario 2: owner succeeds, recorded in audit log ===
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  update lead_reports set cold = 24, consultation = 16 where id = v_report; -- sum still 50

  perform set_config('request.jwt.claim.sub', null, true);
  select id into v_report from lead_reports where id = v_report and cold = 24 and consultation = 16;
  if v_report is null then
    raise exception 'SCENARIO 2 FAILED: owner edit did not apply';
  end if;
  raise notice 'SCENARIO 2 PASSED: owner edit on locked period succeeded';
  -- (audit log itself for owner edits is T-5 / CC-B12, not yet implemented —
  --  this scenario only proves the owner bypass, per CC-B11 scope.)

  -- === Scenario 3: closing 10 Sep for lead_date 20 Agu saved despite Aug locked,
  --                 bucket 20 Agu corrected ===
  perform set_config('request.jwt.claim.sub', v_cs::text, true);
  insert into closings (
    brand_id, cs_id, first_name, whatsapp_raw, lead_date, source_id,
    previous_stage, closing_date, program_id, departure_id,
    room_type, pax, price_at_transaction, total_value, payment_status
  ) values (
    v_brand, v_cs, 'Budi', '081199999999', '2026-08-20', v_source,
    'offering', '2026-09-10', v_program, v_departure,
    'quad', 1, 32900000, 32900000, 'dp'
  );

  perform set_config('request.jwt.claim.sub', null, true);
  perform 1 from lead_reports where id = v_report and offering = 9 and closing = 1;
  if not found then
    raise exception 'SCENARIO 3 FAILED: August bucket not corrected after locked-period closing';
  end if;
  raise notice 'SCENARIO 3 PASSED: closing in Sep for Aug lead saved, August bucket corrected (offering=9, closing=1)';

  -- === Scenario 4: correction shows up in audit log as cross_period_correction ===
  perform 1 from audit_logs
  where brand_id = v_brand and table_name = 'lead_reports'
    and record_id = v_report and action = 'cross_period_correction';
  if not found then
    raise exception 'SCENARIO 4 FAILED: no cross_period_correction audit row found';
  end if;
  raise notice 'SCENARIO 4 PASSED: cross_period_correction recorded in audit_logs';
end $$;

rollback;
