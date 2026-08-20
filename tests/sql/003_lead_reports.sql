-- Proof for CC-B04 "selesai kalau": duplicate idempotency_key produces one
-- row, and cold+consultation+offering+closing <> total_lead is rejected.

begin;

insert into brands (name, slug) values ('Labbaika Group', 'labbaika-lr-test');
do $$
declare v_cs uuid;
begin
  insert into auth.users (id) values (gen_random_uuid()) returning id into v_cs;
  insert into app_users (id, brand_id, full_name, role)
    select v_cs, id, 'Reza', 'cs' from brands where slug = 'labbaika-lr-test';
end $$;
insert into lead_sources (brand_id, name, slug)
  select id, 'Facebook CTWA', 'facebook-ctwa' from brands where slug = 'labbaika-lr-test';

-- Insert twice with the same idempotency_key: must yield exactly one row.
do $$
declare
  v_brand uuid;
  v_cs uuid;
  v_source uuid;
begin
  select id into v_brand from brands where slug = 'labbaika-lr-test';
  select id into v_cs from app_users where brand_id = v_brand;
  select id into v_source from lead_sources where brand_id = v_brand;

  insert into lead_reports (brand_id, cs_id, report_date, source_id, total_lead, cold, consultation, offering, idempotency_key)
  values (v_brand, v_cs, '2026-08-19', v_source, 32, 17, 9, 6, 'idem-key-abc')
  on conflict (brand_id, idempotency_key) where idempotency_key is not null do nothing;

  insert into lead_reports (brand_id, cs_id, report_date, source_id, total_lead, cold, consultation, offering, idempotency_key)
  values (v_brand, v_cs, '2026-08-19', v_source, 32, 17, 9, 6, 'idem-key-abc')
  on conflict (brand_id, idempotency_key) where idempotency_key is not null do nothing;

  if (select count(*) from lead_reports where idempotency_key = 'idem-key-abc') <> 1 then
    raise exception 'TEST FAILED: expected 1 row for duplicate idempotency_key, got %',
      (select count(*) from lead_reports where idempotency_key = 'idem-key-abc');
  end if;
  raise notice 'TEST PASSED: duplicate idempotency_key collapsed to 1 row';
end $$;

-- cold+consultation+offering+closing <> total_lead must be REJECTED.
do $$
declare
  v_brand uuid;
  v_cs uuid;
  v_source uuid;
begin
  select id into v_brand from brands where slug = 'labbaika-lr-test';
  select id into v_cs from app_users where brand_id = v_brand;
  select id into v_source from lead_sources where brand_id = v_brand;

  begin
    insert into lead_reports (brand_id, cs_id, report_date, source_id, total_lead, cold, consultation, offering)
    values (v_brand, v_cs, '2026-08-20', v_source, 50, 17, 9, 6); -- sums to 32, not 50
    raise exception 'TEST FAILED: mismatched stage sum was accepted';
  exception
    when check_violation then
      raise notice 'TEST PASSED: stage sum mismatch correctly rejected (%)', sqlerrm;
  end;
end $$;

rollback;
