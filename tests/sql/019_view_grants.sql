-- Proof for S0-01 fix (07-AUDIT-REPO.md): anon can no longer read
-- v_closing_enriched or call the analytics RPCs; owner still gets correct
-- numbers; a caller cannot pass another brand's id.
--
-- Diperbarui setelah migrasi 023 (10-AUDIT-FE-BE.md #20). Dua perubahan:
--   - gross_profit tidak ada lagi di mana pun -- HPP di luar lingkup, yang
--     diukur omset. Assertion angka owner beralih ke gross_booking_value.
--   - masking profit untuk cs digantikan aturan yang lebih tegas: cs sama
--     sekali tidak boleh memanggil get_dashboard_overview (angka se-brand),
--     dan get_cs_performance hanya mengembalikan BARISNYA SENDIRI. Dulu
--     penyaringan itu ada di app/api/dashboard/cs-performance/route.ts, dan
--     filter di TypeScript bukan batas keamanan ketika RPC-nya bisa dipanggil
--     langsung dari browser dengan anon key.
--
-- Run as the real anon/authenticated roles (SET ROLE + JWT claim stub),
-- not superuser -- superuser bypasses RLS and grants entirely, which is
-- exactly how S0-01/S0-02 went undetected in the first place.

begin;

insert into brands (name, slug) values ('Labbaika Group', 'labbaika-019-test');
insert into brands (name, slug) values ('Other Brand', 'other-019-test');

do $$
declare
  v_brand uuid; v_other_brand uuid; v_owner uuid; v_cs uuid; v_source uuid;
  v_program uuid; v_departure uuid;
begin
  select id into v_brand from brands where slug = 'labbaika-019-test';
  select id into v_other_brand from brands where slug = 'other-019-test';
  insert into auth.users (id) values (gen_random_uuid()) returning id into v_owner;
  insert into auth.users (id) values (gen_random_uuid()) returning id into v_cs;

  insert into app_users (id, brand_id, full_name, role) values (v_owner, v_brand, 'Owner', 'owner');
  insert into app_users (id, brand_id, full_name, role) values (v_cs, v_brand, 'CS', 'cs');

  insert into lead_sources (brand_id, name, slug) values (v_brand, 'FB', 'fb') returning id into v_source;
  insert into programs (brand_id, name, destination, duration_days) values (v_brand, 'P', 'X', 9) returning id into v_program;
  insert into program_departures (brand_id, program_id, departure_date) values (v_brand, v_program, '2026-12-01') returning id into v_departure;

  -- matching lead_report so T-2/T-1 actually link the closing and sync its
  -- bucket -- without this, get_cs_performance's `closing` (from the
  -- lead_reports bucket, not a raw closings count) stays 0 regardless of
  -- the S0-01 fix, which is correct trigger behavior, not a masking bug.
  insert into lead_reports (brand_id, cs_id, report_date, source_id, total_lead, cold, consultation, offering)
  values (v_brand, v_cs, '2026-08-19', v_source, 1, 0, 0, 1);

  insert into closings (
    brand_id, cs_id, first_name, whatsapp_raw, lead_date, source_id, previous_stage,
    closing_date, program_id, departure_id, room_type, pax, price_at_transaction, total_value, payment_status
  ) values (
    v_brand, v_cs, 'Budi', '081234500099', '2026-08-19', v_source, 'offering',
    '2026-08-20', v_program, v_departure, 'quad', 1, 32900000, 32900000, 'lunas'
  );

  create temp table rls_019_ids as
    select v_brand as brand_id, v_other_brand as other_brand_id, v_owner as owner_id, v_cs as cs_id;
  grant select on rls_019_ids to authenticated, anon;
end $$;

-- === anon: no direct view access, no RPC access ===
set role anon;

do $$
begin
  perform 1 from v_closing_enriched limit 1;
  raise exception 'TEST FAILED: anon read v_closing_enriched directly (should be revoked)';
exception
  when insufficient_privilege then
    raise notice 'TEST 1 PASSED: anon has no SELECT on v_closing_enriched';
end $$;

do $$
declare v_brand uuid;
begin
  select brand_id into v_brand from rls_019_ids;
  perform * from get_dashboard_overview(v_brand, '2026-08-01', '2026-08-31', 'cash', null, null);
  raise exception 'TEST FAILED: anon executed get_dashboard_overview (should be revoked)';
exception
  when insufficient_privilege then
    raise notice 'TEST 2 PASSED: anon cannot execute get_dashboard_overview';
end $$;

reset role;

-- === owner: full numbers still correct ===
set role authenticated;
select set_config('request.jwt.claim.sub', owner_id::text, false) from rls_019_ids;

do $$
declare v_brand uuid; v_omset bigint;
begin
  select brand_id into v_brand from rls_019_ids;
  select gross_booking_value into v_omset
    from get_dashboard_overview(v_brand, '2026-08-01', '2026-08-31', 'cash', null, null);
  if v_omset <> 32900000 then
    raise exception 'TEST FAILED: owner overview omset=%, expected 32900000', v_omset;
  end if;
  raise notice 'TEST 3 PASSED: owner still sees correct omset via get_dashboard_overview (%)', v_omset;
end $$;

-- owner cannot read another brand's numbers by passing its id
do $$
declare v_other uuid;
begin
  select other_brand_id into v_other from rls_019_ids;
  perform * from get_dashboard_overview(v_other, '2026-08-01', '2026-08-31', 'cash', null, null);
  raise exception 'TEST FAILED: owner of brand A read brand B via explicit p_brand_id';
exception
  when others then
    if sqlerrm like '%akses ditolak%' then
      raise notice 'TEST 4 PASSED: cross-brand p_brand_id rejected (%)', sqlerrm;
    else
      raise exception 'TEST FAILED: wrong error: %', sqlerrm;
    end if;
end $$;

-- === cs: ditolak di angka se-brand, dan hanya melihat barisnya sendiri ===
select set_config('request.jwt.claim.sub', cs_id::text, false) from rls_019_ids;

do $$
declare v_brand uuid;
begin
  select brand_id into v_brand from rls_019_ids;
  perform * from get_dashboard_overview(v_brand, '2026-08-01', '2026-08-31', 'cash', null, null);
  raise exception 'TEST 5 FAILED: cs berhasil menarik angka omset/spend se-brand';
exception
  when others then
    if sqlerrm like '%hanya owner%' then
      raise notice 'TEST 5 PASSED: cs ditolak get_dashboard_overview (%)', sqlerrm;
    else
      raise exception 'TEST 5 FAILED: error tidak sesuai: %', sqlerrm;
    end if;
end $$;

do $$
declare v_brand uuid; v_self uuid; v_rows int := 0; r record;
begin
  select brand_id, cs_id into v_brand, v_self from rls_019_ids;
  for r in select * from get_cs_performance(v_brand, '2026-08-01', '2026-08-31') loop
    v_rows := v_rows + 1;
    if r.cs_id <> v_self then
      raise exception 'TEST 6 FAILED: cs melihat baris cs lain (%)', r.cs_id;
    end if;
    if r.closing <> 1 or r.total_lead <> 1 then
      raise exception 'TEST 6 FAILED: angka sendiri rusak, closing=%, total_lead=%', r.closing, r.total_lead;
    end if;
  end loop;
  if v_rows <> 1 then
    raise exception 'TEST 6 FAILED: cs dapat % baris dari get_cs_performance, harus tepat 1', v_rows;
  end if;
  raise notice 'TEST 6 PASSED: cs hanya menerima barisnya sendiri dari get_cs_performance';
end $$;

reset role;
rollback;
