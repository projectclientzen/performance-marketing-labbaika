-- Proof for CC-B05 "selesai kalau": closing_date < lead_date, pax = 0, and
-- paid_amount > total_value are all rejected by the database.

begin;

insert into brands (name, slug) values ('Labbaika Group', 'labbaika-cl-test');
do $$
declare v_cs uuid;
begin
  insert into auth.users (id) values (gen_random_uuid()) returning id into v_cs;
  insert into app_users (id, brand_id, full_name, role)
    select v_cs, id, 'Reza', 'cs' from brands where slug = 'labbaika-cl-test';
end $$;
insert into lead_sources (brand_id, name, slug)
  select id, 'Facebook CTWA', 'facebook-ctwa' from brands where slug = 'labbaika-cl-test';
insert into programs (brand_id, name, destination, duration_days)
  select id, 'Umroh Turki 16D', 'Turki', 16 from brands where slug = 'labbaika-cl-test';
insert into program_departures (brand_id, program_id, departure_date)
  select b.id, p.id, '2026-10-12'
  from brands b join programs p on p.brand_id = b.id
  where b.slug = 'labbaika-cl-test';

do $$
declare
  v_brand uuid; v_cs uuid; v_source uuid; v_program uuid; v_departure uuid;
begin
  select id into v_brand from brands where slug = 'labbaika-cl-test';
  select id into v_cs from app_users where brand_id = v_brand;
  select id into v_source from lead_sources where brand_id = v_brand;
  select id into v_program from programs where brand_id = v_brand;
  select id into v_departure from program_departures where program_id = v_program;

  -- 1. closing_date < lead_date must be REJECTED.
  begin
    insert into closings (
      brand_id, cs_id, first_name, whatsapp_raw, whatsapp_e164,
      lead_date, source_id, previous_stage,
      closing_date, program_id, departure_id, room_type, pax,
      price_at_transaction, total_value, payment_status
    ) values (
      v_brand, v_cs, 'Budi', '081234567890', '+6281234567890',
      '2026-08-19', v_source, 'offering',
      '2026-08-10', v_program, v_departure, 'quad', 1,
      32900000, 32900000, 'dp'
    );
    raise exception 'TEST FAILED: closing_date < lead_date was accepted';
  exception
    when check_violation then
      raise notice 'TEST PASSED: closing_date < lead_date rejected (%)', sqlerrm;
  end;

  -- 2. pax = 0 must be REJECTED.
  begin
    insert into closings (
      brand_id, cs_id, first_name, whatsapp_raw, whatsapp_e164,
      lead_date, source_id, previous_stage,
      closing_date, program_id, departure_id, room_type, pax,
      price_at_transaction, total_value, payment_status
    ) values (
      v_brand, v_cs, 'Budi', '081234567891', '+6281234567891',
      '2026-08-19', v_source, 'offering',
      '2026-08-23', v_program, v_departure, 'quad', 0,
      32900000, 0, 'dp'
    );
    raise exception 'TEST FAILED: pax = 0 was accepted';
  exception
    when check_violation then
      raise notice 'TEST PASSED: pax = 0 rejected (%)', sqlerrm;
  end;

  -- 3. paid_amount > total_value must be REJECTED.
  begin
    insert into closings (
      brand_id, cs_id, first_name, whatsapp_raw, whatsapp_e164,
      lead_date, source_id, previous_stage,
      closing_date, program_id, departure_id, room_type, pax,
      price_at_transaction, total_value, payment_status, paid_amount
    ) values (
      v_brand, v_cs, 'Budi', '081234567892', '+6281234567892',
      '2026-08-19', v_source, 'offering',
      '2026-08-23', v_program, v_departure, 'quad', 1,
      32900000, 32900000, 'dp', 50000000
    );
    raise exception 'TEST FAILED: paid_amount > total_value was accepted';
  exception
    when check_violation then
      raise notice 'TEST PASSED: paid_amount > total_value rejected (%)', sqlerrm;
  end;

  -- 4. Sanity: a fully valid closing must succeed and gross_profit computes.
  -- cost_at_transaction/cost_source are intentionally NOT set here: once
  -- trigger T-7 exists (migration 008), it owns those columns and overwrites
  -- any value supplied on INSERT — see tests/sql/008_cost_lock.sql for the
  -- authoritative cost-locking proof. Without a matching program_costs row
  -- or brand_settings.default_margin_pct, T-7 leaves cost unknown and
  -- gross_profit falls back to total_value, which this only asserts.
  insert into closings (
    brand_id, cs_id, first_name, whatsapp_raw, whatsapp_e164,
    lead_date, source_id, previous_stage,
    closing_date, program_id, departure_id, room_type, pax,
    price_at_transaction, total_value, payment_status, paid_amount
  ) values (
    v_brand, v_cs, 'Budi', '081234567893', '+6281234567893',
    '2026-08-19', v_source, 'offering',
    '2026-08-23', v_program, v_departure, 'quad', 1,
    32900000, 32900000, 'dp', 5000000
  );

  if (select gross_profit from closings where whatsapp_e164 = '+6281234567893') <> 32900000 then
    raise exception 'TEST FAILED: gross_profit computed wrong, got %',
      (select gross_profit from closings where whatsapp_e164 = '+6281234567893');
  end if;
  raise notice 'TEST PASSED: valid closing accepted, gross_profit = total_value (no cost data available)';
end $$;

rollback;
