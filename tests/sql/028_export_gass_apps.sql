-- Proof for 028_add_export_gass_apps.sql: owner gets closings joined to
-- the CS's whatsapp, cancelled closings are dropped, anon/cs are rejected,
-- cross-brand p_brand_id is rejected. Run as real anon/authenticated
-- roles, not superuser.

begin;

insert into brands (name, slug) values ('Labbaika Group', 'labbaika-028-test');
insert into brands (name, slug) values ('Other Brand', 'other-028-test');

do $$
declare
  v_brand uuid; v_other_brand uuid; v_owner uuid; v_cs uuid; v_source uuid;
  v_program uuid; v_departure uuid;
begin
  select id into v_brand from brands where slug = 'labbaika-028-test';
  select id into v_other_brand from brands where slug = 'other-028-test';

  insert into auth.users (id) values (gen_random_uuid()) returning id into v_owner;
  insert into auth.users (id) values (gen_random_uuid()) returning id into v_cs;

  insert into app_users (id, brand_id, full_name, role) values (v_owner, v_brand, 'Owner', 'owner');
  insert into app_users (id, brand_id, full_name, whatsapp, role)
    values (v_cs, v_brand, 'CS', '+6281200002222', 'cs');

  insert into lead_sources (brand_id, name, slug) values (v_brand, 'FB', 'fb') returning id into v_source;
  insert into programs (brand_id, name, destination, duration_days) values (v_brand, 'P', 'X', 9) returning id into v_program;
  insert into program_departures (brand_id, program_id, departure_date) values (v_brand, v_program, '2026-12-01') returning id into v_departure;

  -- active closing -- should appear
  insert into closings (
    brand_id, cs_id, first_name, whatsapp_raw, whatsapp_e164,
    lead_date, source_id, previous_stage, closing_date, program_id, departure_id, room_type, pax,
    price_at_transaction, total_value, payment_status
  ) values (
    v_brand, v_cs, 'Budi', '081234500099', '+6281234500099',
    '2026-08-19', v_source, 'offering', '2026-08-20', v_program, v_departure, 'quad', 1,
    32900000, 32900000, 'lunas'
  );

  -- cancelled -- must NOT appear ("Purchase" format, not a purchase)
  insert into closings (
    brand_id, cs_id, first_name, whatsapp_raw, whatsapp_e164,
    lead_date, source_id, previous_stage, closing_date, program_id, departure_id, room_type, pax,
    price_at_transaction, total_value, payment_status
  ) values (
    v_brand, v_cs, 'Rudi', '081234500097', '+6281234500097',
    '2026-08-19', v_source, 'offering', '2026-08-20', v_program, v_departure, 'quad', 1,
    32900000, 32900000, 'cancelled'
  );

  create temp table t028_ids as
    select v_brand as brand_id, v_other_brand as other_brand_id, v_owner as owner_id, v_cs as cs_id;
  grant select on t028_ids to authenticated, anon;
end $$;

-- === anon: no direct execute ===
set role anon;

do $$
declare v_brand uuid;
begin
  select brand_id into v_brand from t028_ids;
  perform * from get_export_gass_apps(v_brand);
  raise exception 'TEST FAILED: anon executed get_export_gass_apps (should be revoked)';
exception
  when insufficient_privilege then
    raise notice 'TEST 1 PASSED: anon cannot execute get_export_gass_apps';
end $$;

reset role;

-- === cs: role guard rejects ===
set role authenticated;
select set_config('request.jwt.claim.sub', cs_id::text, false) from t028_ids;

do $$
declare v_brand uuid;
begin
  select brand_id into v_brand from t028_ids;
  perform * from get_export_gass_apps(v_brand);
  raise exception 'TEST FAILED: cs executed get_export_gass_apps (owner-only)';
exception
  when others then
    if sqlerrm like '%hanya owner%' then
      raise notice 'TEST 2 PASSED: cs rejected from get_export_gass_apps (%)', sqlerrm;
    else
      raise exception 'TEST FAILED: wrong error: %', sqlerrm;
    end if;
end $$;

-- === owner: gets the active row with cs_whatsapp, cancelled excluded ===
select set_config('request.jwt.claim.sub', owner_id::text, false) from t028_ids;

do $$
declare v_brand uuid; v_count int; v_cs_wa text; v_phone text;
begin
  select brand_id into v_brand from t028_ids;
  select count(*) into v_count from get_export_gass_apps(v_brand);
  if v_count <> 1 then
    raise exception 'TEST FAILED: gass apps export rows=%, expected 1 (cancelled excluded)', v_count;
  end if;
  select phone, cs_whatsapp into v_phone, v_cs_wa from get_export_gass_apps(v_brand) limit 1;
  if v_phone <> '+6281234500099' or v_cs_wa <> '+6281200002222' then
    raise exception 'TEST FAILED: wrong row, phone=% cs_whatsapp=%', v_phone, v_cs_wa;
  end if;
  raise notice 'TEST 3 PASSED: owner gets 1 row, phone and cs_whatsapp both correct';
end $$;

-- owner cannot pass another brand's id
do $$
declare v_other uuid;
begin
  select other_brand_id into v_other from t028_ids;
  perform * from get_export_gass_apps(v_other);
  raise exception 'TEST FAILED: owner of brand A read brand B export via explicit p_brand_id';
exception
  when others then
    if sqlerrm like '%akses ditolak%' then
      raise notice 'TEST 4 PASSED: cross-brand p_brand_id rejected on export (%)', sqlerrm;
    else
      raise exception 'TEST FAILED: wrong error: %', sqlerrm;
    end if;
end $$;

reset role;
rollback;
