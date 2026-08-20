-- Bukti untuk migrasi 024 (10-AUDIT-FE-BE.md #21): role `advertiser` punya
-- akses setara `owner`, sementara `cs` tetap terpisah.
--
-- Dijalankan sebagai role `authenticated` sungguhan dengan klaim JWT
-- (`request.jwt.claim.sub`), bukan superuser -- superuser melewati RLS dan
-- grant sepenuhnya, dan itulah cara S0-01/S0-02 dulu lolos.

begin;

insert into brands (name, slug) values ('Labbaika Group', 'labbaika-024-test');

do $$
declare v_brand uuid; v_adv uuid; v_cs uuid;
begin
  select id into v_brand from brands where slug = 'labbaika-024-test';
  insert into auth.users (id) values (gen_random_uuid()) returning id into v_adv;
  insert into auth.users (id) values (gen_random_uuid()) returning id into v_cs;
  insert into app_users (id, brand_id, full_name, role) values (v_adv, v_brand, 'Maszen', 'advertiser');
  insert into app_users (id, brand_id, full_name, role) values (v_cs, v_brand, 'Reza', 'cs');

  create temp table t024_ids as
    select v_brand as brand_id, v_adv as adv_id, v_cs as cs_id;
  grant select on t024_ids to authenticated;
end $$;

-- === advertiser: setara owner ===
set local role authenticated;
select set_config('request.jwt.claim.sub', adv_id::text, false) from t024_ids;

do $$
declare v_brand uuid; v_n int;
begin
  select brand_id into v_brand from t024_ids;

  if not current_has_owner_access() then
    raise exception 'TEST 1 FAILED: advertiser tidak diakui current_has_owner_access()';
  end if;
  raise notice 'TEST 1 PASSED: advertiser diakui punya akses setara owner';

  -- Peran sebenarnya tidak boleh ikut berubah: audit_logs dan manajemen user
  -- bergantung padanya. Ini yang membedakan pendekatan 024 dari jalan pintas
  -- "bikin current_app_role() mengembalikan owner untuk advertiser".
  if current_app_role()::text <> 'advertiser' then
    raise exception 'TEST 2 FAILED: current_app_role()=%, peran sebenarnya hilang', current_app_role();
  end if;
  raise notice 'TEST 2 PASSED: current_app_role() tetap mengembalikan advertiser, bukan owner';

  perform * from get_dashboard_overview(v_brand, '2026-08-01', '2026-08-31', 'cash', null, null);
  perform * from get_campaign_quality(v_brand, '2026-08-01', '2026-08-31', 'cohort');
  perform * from get_lead_insight_summary(v_brand, '2026-08-01', '2026-08-31');
  perform * from get_export_operational(v_brand);
  perform * from get_export_meta_ltv(v_brand);
  raise notice 'TEST 3 PASSED: advertiser boleh memanggil kelima fungsi owner-only';

  -- RLS tabel owner-only: tidak boleh melempar insufficient_privilege.
  select count(*) into v_n from programs;
  select count(*) into v_n from ad_performance;
  select count(*) into v_n from period_locks;
  raise notice 'TEST 4 PASSED: advertiser boleh membaca tabel owner-only lewat RLS';

  -- Owner-level melihat SELURUH cs; penyaringan per-cs (migrasi 023) hanya
  -- berlaku untuk cs itu sendiri.
  select count(*) into v_n from get_cs_performance(v_brand, '2026-08-01', '2026-08-31');
  if v_n <> 1 then
    raise exception 'TEST 5 FAILED: advertiser dapat % baris cs, harus 1 (jumlah cs di brand)', v_n;
  end if;
  raise notice 'TEST 5 PASSED: advertiser melihat baris seluruh cs (%)', v_n;
end $$;

-- === cs: tidak ikut naik ===
select set_config('request.jwt.claim.sub', cs_id::text, false) from t024_ids;

do $$
declare v_brand uuid;
begin
  select brand_id into v_brand from t024_ids;

  if current_has_owner_access() then
    raise exception 'TEST 6 FAILED: cs dianggap punya akses owner-level';
  end if;
  raise notice 'TEST 6 PASSED: cs tetap ditolak current_has_owner_access()';

  begin
    perform * from get_dashboard_overview(v_brand, '2026-08-01', '2026-08-31', 'cash', null, null);
    raise exception 'TEST 7 FAILED: cs berhasil menarik omset/spend se-brand';
  exception
    when insufficient_privilege then
      raise notice 'TEST 7 PASSED: cs ditolak get_dashboard_overview';
  end;
end $$;

reset role;
rollback;
