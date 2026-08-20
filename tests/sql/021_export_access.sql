-- Proof for 10-AUDIT-FE-BE.md #1 fix: owner can export via
-- get_export_operational/get_export_meta_ltv; anon and cs cannot; cross-brand
-- p_brand_id is rejected; meta export drops non-consented/cancelled rows.
--
-- Run as the real anon/authenticated roles (SET ROLE + JWT claim stub), not
-- superuser -- superuser bypasses RLS and grants entirely, same reason
-- 019/020's tests do this.

begin;

insert into brands (name, slug) values ('Labbaika Group', 'labbaika-021-test');
insert into brands (name, slug) values ('Other Brand', 'other-021-test');

do $$
declare
  v_brand uuid; v_other_brand uuid; v_owner uuid; v_cs uuid; v_source uuid;
  v_program uuid; v_departure uuid;
begin
  select id into v_brand from brands where slug = 'labbaika-021-test';
  select id into v_other_brand from brands where slug = 'other-021-test';

  -- captured via RETURNING, not `offset .. limit 1` against the whole
  -- table -- this runs against a real project that can have real rows in
  -- auth.users, and grabbing an arbitrary existing user instead of the one
  -- just inserted would attach test app_users/closings data to a real
  -- identity.
  insert into auth.users (id) values (gen_random_uuid()) returning id into v_owner;
  insert into auth.users (id) values (gen_random_uuid()) returning id into v_cs;

  insert into app_users (id, brand_id, full_name, role) values (v_owner, v_brand, 'Owner', 'owner');
  insert into app_users (id, brand_id, full_name, role) values (v_cs, v_brand, 'CS', 'cs');

  insert into lead_sources (brand_id, name, slug) values (v_brand, 'FB', 'fb') returning id into v_source;
  insert into programs (brand_id, name, destination, duration_days) values (v_brand, 'P', 'X', 9) returning id into v_program;
  insert into program_departures (brand_id, program_id, departure_date) values (v_brand, v_program, '2026-12-01') returning id into v_departure;
  insert into program_costs (brand_id, program_id, departure_id, room_type, cost_price, effective_date)
    values (v_brand, v_program, v_departure, 'quad', 28952000, '2026-08-01');

  -- consented, active closing -- should appear in both exports
  insert into closings (
    brand_id, cs_id, first_name, whatsapp_raw, whatsapp_e164, email, pdp_consent, pdp_consent_at,
    lead_date, source_id, previous_stage, closing_date, program_id, departure_id, room_type, pax,
    price_at_transaction, total_value, payment_status
  ) values (
    v_brand, v_cs, 'Budi', '081234500099', '+6281234500099', 'budi@example.com', true, now(),
    '2026-08-19', v_source, 'offering', '2026-08-20', v_program, v_departure, 'quad', 1,
    32900000, 32900000, 'lunas'
  );

  -- non-consented closing -- must appear in operational, NOT in meta
  insert into closings (
    brand_id, cs_id, first_name, whatsapp_raw, whatsapp_e164, pdp_consent,
    lead_date, source_id, previous_stage, closing_date, program_id, departure_id, room_type, pax,
    price_at_transaction, total_value, payment_status
  ) values (
    v_brand, v_cs, 'Siti', '081234500098', '+6281234500098', false,
    '2026-08-19', v_source, 'offering', '2026-08-20', v_program, v_departure, 'quad', 1,
    32900000, 32900000, 'lunas'
  );

  -- consented but cancelled -- must NOT appear in meta
  insert into closings (
    brand_id, cs_id, first_name, whatsapp_raw, whatsapp_e164, pdp_consent, pdp_consent_at,
    lead_date, source_id, previous_stage, closing_date, program_id, departure_id, room_type, pax,
    price_at_transaction, total_value, payment_status
  ) values (
    v_brand, v_cs, 'Rudi', '081234500097', '+6281234500097', true, now(),
    '2026-08-19', v_source, 'offering', '2026-08-20', v_program, v_departure, 'quad', 1,
    32900000, 32900000, 'cancelled'
  );

  create temp table export_021_ids as
    select v_brand as brand_id, v_other_brand as other_brand_id, v_owner as owner_id, v_cs as cs_id;
  grant select on export_021_ids to authenticated, anon;
end $$;

-- === anon: no direct execute ===
set role anon;

do $$
declare v_brand uuid;
begin
  select brand_id into v_brand from export_021_ids;
  perform * from get_export_operational(v_brand);
  raise exception 'TEST FAILED: anon executed get_export_operational (should be revoked)';
exception
  when insufficient_privilege then
    raise notice 'TEST 1 PASSED: anon cannot execute get_export_operational';
end $$;

reset role;

-- === cs: role guard rejects even with a valid brand ===
set role authenticated;
select set_config('request.jwt.claim.sub', cs_id::text, false) from export_021_ids;

do $$
declare v_brand uuid;
begin
  select brand_id into v_brand from export_021_ids;
  perform * from get_export_operational(v_brand);
  raise exception 'TEST FAILED: cs executed get_export_operational (owner-only)';
exception
  when others then
    if sqlerrm like '%hanya owner%' then
      raise notice 'TEST 2 PASSED: cs rejected from get_export_operational (%)', sqlerrm;
    else
      raise exception 'TEST FAILED: wrong error: %', sqlerrm;
    end if;
end $$;

-- === owner: gets rows, PII intact ===
select set_config('request.jwt.claim.sub', owner_id::text, false) from export_021_ids;

do $$
declare v_brand uuid; v_count int;
begin
  select brand_id into v_brand from export_021_ids;
  -- operational export has no default status filter (unlike meta, which
  -- always drops cancelled) -- all 3 seeded closings, cancelled included.
  select count(*) into v_count from get_export_operational(v_brand);
  if v_count <> 3 then
    raise exception 'TEST FAILED: operational export rows=%, expected 3 (no default status filter)', v_count;
  end if;
  select count(*) into v_count from get_export_operational(v_brand, null, null, null, null, null, 'cancelled');
  if v_count <> 1 then
    raise exception 'TEST FAILED: operational export with p_status=cancelled rows=%, expected 1', v_count;
  end if;
  raise notice 'TEST 3 PASSED: owner operational export returns 3 rows unfiltered, 1 with p_status=cancelled';
end $$;

-- owner cannot pass another brand's id
do $$
declare v_other uuid;
begin
  select other_brand_id into v_other from export_021_ids;
  perform * from get_export_operational(v_other);
  raise exception 'TEST FAILED: owner of brand A read brand B export via explicit p_brand_id';
exception
  when others then
    if sqlerrm like '%akses ditolak%' then
      raise notice 'TEST 4 PASSED: cross-brand p_brand_id rejected on export (%)', sqlerrm;
    else
      raise exception 'TEST FAILED: wrong error: %', sqlerrm;
    end if;
end $$;

-- meta export: only the consented, non-cancelled row
do $$
declare v_brand uuid; v_count int; v_phone text;
begin
  select brand_id into v_brand from export_021_ids;
  select count(*) into v_count from get_export_meta_ltv(v_brand);
  if v_count <> 1 then
    raise exception 'TEST FAILED: meta export rows=%, expected 1 (pdp_consent=true and not cancelled)', v_count;
  end if;
  select phone into v_phone from get_export_meta_ltv(v_brand) limit 1;
  if v_phone <> '+6281234500099' then
    raise exception 'TEST FAILED: meta export returned wrong row, phone=%', v_phone;
  end if;
  raise notice 'TEST 5 PASSED: meta export returns exactly the consented, non-cancelled row';
end $$;

reset role;
rollback;
