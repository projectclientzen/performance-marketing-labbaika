-- Proof for T-2 resolve_lead_report_link: matches brand+cs+lead_date+source,
-- leaves NULL when no report matches.

begin;

insert into brands (name, slug) values ('Labbaika Group', 'labbaika-link-test');
do $$
declare v_cs uuid;
begin
  insert into auth.users (id) values (gen_random_uuid()) returning id into v_cs;
  insert into app_users (id, brand_id, full_name, role)
    select v_cs, id, 'Reza', 'cs' from brands where slug = 'labbaika-link-test';
end $$;
insert into lead_sources (brand_id, name, slug)
  select id, 'Facebook CTWA', 'facebook-ctwa' from brands where slug = 'labbaika-link-test';
insert into programs (brand_id, name, destination, duration_days)
  select id, 'Umroh Turki 16D', 'Turki', 16 from brands where slug = 'labbaika-link-test';
insert into program_departures (brand_id, program_id, departure_date)
  select b.id, p.id, '2026-10-12'
  from brands b join programs p on p.brand_id = b.id
  where b.slug = 'labbaika-link-test';

do $$
declare
  v_brand uuid; v_cs uuid; v_source uuid; v_program uuid; v_departure uuid; v_report uuid;
  v_linked uuid;
begin
  select id into v_brand from brands where slug = 'labbaika-link-test';
  select id into v_cs from app_users where brand_id = v_brand;
  select id into v_source from lead_sources where brand_id = v_brand;
  select id into v_program from programs where brand_id = v_brand;
  select id into v_departure from program_departures where program_id = v_program;

  insert into lead_reports (brand_id, cs_id, report_date, source_id, total_lead, cold, consultation, offering)
  values (v_brand, v_cs, '2026-08-19', v_source, 50, 25, 15, 10)
  returning id into v_report;

  -- Matching closing: lead_report_id should auto-resolve.
  insert into closings (
    brand_id, cs_id, first_name, whatsapp_raw,
    lead_date, source_id, previous_stage,
    closing_date, program_id, departure_id, room_type, pax,
    price_at_transaction, total_value, payment_status
  ) values (
    v_brand, v_cs, 'Budi', '081234567800',
    '2026-08-19', v_source, 'offering',
    '2026-08-23', v_program, v_departure, 'quad', 1,
    32900000, 32900000, 'dp'
  ) returning lead_report_id into v_linked;

  if v_linked <> v_report then
    raise exception 'TEST FAILED: expected lead_report_id=%, got %', v_report, v_linked;
  end if;
  raise notice 'TEST PASSED: matching closing auto-linked to lead_report_id';

  -- Non-matching closing (different lead_date, no report exists): lead_report_id must stay NULL.
  insert into closings (
    brand_id, cs_id, first_name, whatsapp_raw,
    lead_date, source_id, previous_stage,
    closing_date, program_id, departure_id, room_type, pax,
    price_at_transaction, total_value, payment_status
  ) values (
    v_brand, v_cs, 'Budi', '081234567801',
    '2026-07-01', v_source, 'offering',
    '2026-08-23', v_program, v_departure, 'quad', 1,
    32900000, 32900000, 'dp'
  ) returning lead_report_id into v_linked;

  if v_linked is not null then
    raise exception 'TEST FAILED: expected NULL lead_report_id, got %', v_linked;
  end if;
  raise notice 'TEST PASSED: unmatched closing left lead_report_id NULL';
end $$;

rollback;
