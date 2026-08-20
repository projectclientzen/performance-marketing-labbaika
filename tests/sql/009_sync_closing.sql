-- Proof for CC-B09 "selesai kalau" — all 7 scenarios.

begin;

insert into brands (name, slug) values ('Labbaika Group', 'labbaika-sync-test');
do $$
declare v_cs uuid;
begin
  insert into auth.users (id) values (gen_random_uuid()) returning id into v_cs;
  insert into app_users (id, brand_id, full_name, role)
    select v_cs, id, 'Reza', 'cs' from brands where slug = 'labbaika-sync-test';
end $$;
insert into lead_sources (brand_id, name, slug)
  select id, 'Facebook CTWA', 'facebook-ctwa' from brands where slug = 'labbaika-sync-test';
insert into programs (brand_id, name, destination, duration_days)
  select id, 'Umroh Turki 16D', 'Turki', 16 from brands where slug = 'labbaika-sync-test';
insert into program_departures (brand_id, program_id, departure_date)
  select b.id, p.id, '2026-10-12' from brands b join programs p on p.brand_id = b.id
  where b.slug = 'labbaika-sync-test';

do $$
declare
  v_brand uuid; v_cs uuid; v_source uuid; v_program uuid; v_departure uuid;
  v_report1 uuid; v_report2 uuid; v_closing1 uuid; v_closing6 uuid; v_lr6 uuid;
  r record;
begin
  select id into v_brand from brands where slug = 'labbaika-sync-test';
  select id into v_cs from app_users where brand_id = v_brand;
  select id into v_source from lead_sources where brand_id = v_brand;
  select id into v_program from programs where brand_id = v_brand;
  select id into v_departure from program_departures where program_id = v_program;

  -- Report 19 Agu: total 50, cold 25, cons 15, offering 10, closing 0.
  insert into lead_reports (brand_id, cs_id, report_date, source_id, total_lead, cold, consultation, offering)
  values (v_brand, v_cs, '2026-08-19', v_source, 50, 25, 15, 10)
  returning id into v_report1;

  -- Report 1 Jul: another report, for scenario 5 (move lead_date to different report).
  insert into lead_reports (brand_id, cs_id, report_date, source_id, total_lead, cold, consultation, offering)
  values (v_brand, v_cs, '2026-07-01', v_source, 20, 10, 6, 4)
  returning id into v_report2;

  -- === Scenario 1: insert closing, previous_stage=offering ===
  insert into closings (
    brand_id, cs_id, first_name, whatsapp_raw, lead_date, source_id,
    lead_report_id, previous_stage, closing_date, program_id, departure_id,
    room_type, pax, price_at_transaction, total_value, payment_status
  ) values (
    v_brand, v_cs, 'Budi', '081111111101', '2026-08-19', v_source,
    v_report1, 'offering', '2026-08-23', v_program, v_departure,
    'quad', 1, 32900000, 32900000, 'dp'
  ) returning id into v_closing1;

  select * into r from lead_reports where id = v_report1;
  if not (r.offering = 9 and r.closing = 1 and r.total_lead = 50) then
    raise exception 'SCENARIO 1 FAILED: offering=%, closing=%, total=%', r.offering, r.closing, r.total_lead;
  end if;
  raise notice 'SCENARIO 1 PASSED: offering=9, closing=1, total=50';

  -- === Scenario 2: cancel closing -> revert ===
  update closings set payment_status = 'cancelled', cancelled_at = now(), cancel_reason = 'test'
  where id = v_closing1;

  select * into r from lead_reports where id = v_report1;
  if not (r.offering = 10 and r.closing = 0) then
    raise exception 'SCENARIO 2 FAILED: offering=%, closing=%', r.offering, r.closing;
  end if;
  raise notice 'SCENARIO 2 PASSED: reverted to offering=10, closing=0';

  -- reset: delete cancelled closing1 to keep state clean for next scenarios
  delete from closings where id = v_closing1;

  -- === Scenario 3: insert closing when offering = 0 -> must fail ===
  update lead_reports set offering = 0, cold = 25, consultation = 25 where id = v_report1; -- force offering to 0, keep sum=50
  begin
    insert into closings (
      brand_id, cs_id, first_name, whatsapp_raw, lead_date, source_id,
      lead_report_id, previous_stage, closing_date, program_id, departure_id,
      room_type, pax, price_at_transaction, total_value, payment_status
    ) values (
      v_brand, v_cs, 'Budi', '081111111102', '2026-08-19', v_source,
      v_report1, 'offering', '2026-08-23', v_program, v_departure,
      'quad', 1, 32900000, 32900000, 'dp'
    );
    raise exception 'SCENARIO 3 FAILED: underflow insert was accepted';
  exception
    when others then
      if sqlerrm like '%tidak cukup untuk dikurangi%' then
        raise notice 'SCENARIO 3 PASSED: STAGE_UNDERFLOW correctly rejected (%)', sqlerrm;
      else
        raise exception 'SCENARIO 3 FAILED: wrong error: %', sqlerrm;
      end if;
  end;
  update lead_reports set offering = 10, cold = 25, consultation = 15 where id = v_report1; -- restore

  -- === Scenario 4: update previous_stage offering -> consultation ===
  insert into closings (
    brand_id, cs_id, first_name, whatsapp_raw, lead_date, source_id,
    lead_report_id, previous_stage, closing_date, program_id, departure_id,
    room_type, pax, price_at_transaction, total_value, payment_status
  ) values (
    v_brand, v_cs, 'Budi', '081111111103', '2026-08-19', v_source,
    v_report1, 'offering', '2026-08-23', v_program, v_departure,
    'quad', 1, 32900000, 32900000, 'dp'
  ) returning id into v_closing1;
  -- state now: offering=9, closing=1

  update closings set previous_stage = 'consultation' where id = v_closing1;

  select * into r from lead_reports where id = v_report1;
  if not (r.offering = 10 and r.consultation = 14 and r.closing = 1) then
    raise exception 'SCENARIO 4 FAILED: offering=%, consultation=%, closing=%', r.offering, r.consultation, r.closing;
  end if;
  raise notice 'SCENARIO 4 PASSED: offering=10 (+1), consultation=14 (-1), closing=1';

  delete from closings where id = v_closing1; -- reset (offering back to 10, cons back to 15, closing 0)

  -- === Scenario 5: update lead_date so it moves to a different report ===
  insert into closings (
    brand_id, cs_id, first_name, whatsapp_raw, lead_date, source_id,
    lead_report_id, previous_stage, closing_date, program_id, departure_id,
    room_type, pax, price_at_transaction, total_value, payment_status
  ) values (
    v_brand, v_cs, 'Budi', '081111111104', '2026-08-19', v_source,
    v_report1, 'offering', '2026-08-23', v_program, v_departure,
    'quad', 1, 32900000, 32900000, 'dp'
  ) returning id into v_closing1;
  -- report1: offering=9, closing=1

  -- API moves this closing to report2 (simulating a lead_date correction)
  update closings set lead_date = '2026-07-01', lead_report_id = v_report2, previous_stage = 'offering'
  where id = v_closing1;

  select * into r from lead_reports where id = v_report1;
  if not (r.offering = 10 and r.closing = 0) then
    raise exception 'SCENARIO 5 FAILED: old report not restored, offering=%, closing=%', r.offering, r.closing;
  end if;
  select * into r from lead_reports where id = v_report2;
  if not (r.offering = 3 and r.closing = 1) then
    raise exception 'SCENARIO 5 FAILED: new report not corrected, offering=%, closing=%', r.offering, r.closing;
  end if;
  raise notice 'SCENARIO 5 PASSED: old report restored (offering=10,closing=0), new report corrected (offering=3,closing=1)';

  delete from closings where id = v_closing1; -- reset report2 to offering=4, closing=0

  -- === Scenario 6: insert closing without a matching report ===
  insert into closings (
    brand_id, cs_id, first_name, whatsapp_raw, lead_date, source_id,
    previous_stage, closing_date, program_id, departure_id,
    room_type, pax, price_at_transaction, total_value, payment_status
  ) values (
    v_brand, v_cs, 'Budi', '081111111105', '2026-05-01', v_source, -- no report exists for this date
    'offering', '2026-08-23', v_program, v_departure,
    'quad', 1, 32900000, 32900000, 'dp'
  ) returning id, lead_report_id into v_closing6, v_lr6;

  if v_closing6 is null then
    raise exception 'SCENARIO 6 FAILED: closing not inserted';
  end if;
  if v_lr6 is not null then
    raise exception 'SCENARIO 6 FAILED: lead_report_id should be NULL, got %', v_lr6;
  end if;
  select * into r from lead_reports where id = v_report1;
  if not (r.offering = 10 and r.closing = 0 and r.total_lead = 50) then
    raise exception 'SCENARIO 6 FAILED: report1 unexpectedly changed';
  end if;
  raise notice 'SCENARIO 6 PASSED: lead_report_id NULL, no report affected';

  -- === Scenario 7: invariant holds across all reports touched above ===
  for r in select id, report_date, cold, consultation, offering, closing, total_lead from lead_reports loop
    if r.cold + r.consultation + r.offering + r.closing <> r.total_lead then
      raise exception 'SCENARIO 7 FAILED: invariant broken on report % (%)', r.id, r.report_date;
    end if;
  end loop;
  raise notice 'SCENARIO 7 PASSED: invariant cold+consultation+offering+closing=total_lead holds on all reports';
end $$;

rollback;
