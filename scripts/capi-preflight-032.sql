-- Preflight migrasi 032 (Purchase CAPI). Tidak menyimpan apa pun: satu-satunya
-- objek yang dibuat adalah temp view, dan transaksinya selalu di-rollback.
--
-- Jalankan ke database TARGET sebelum memasang 032 (staging dulu, produksi
-- hanya setelah disetujui):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/capi-preflight-032.sql
--
-- Hasil: satu baris per pemeriksaan (ok / FAIL / APPLIED). Ada FAIL → skrip
-- berhenti dengan error di akhir; jangan pasang 032 sebelum penyebabnya jelas.
-- 032 sendiri dibungkus begin/commit, jadi kegagalan tidak meninggalkan setengah
-- terpasang — preflight ini mencegah percobaan gagal di produksi sama sekali.
begin;

create temp view capi_preflight as
with expected_view(pos, col) as (
  select ordinality::int, col from unnest(array[
    'id','brand_id','cs_id','first_name','last_name','whatsapp_e164','email',
    'pdp_consent','pdp_consent_at','lead_date','source_id','campaign_id',
    'lead_report_id','previous_stage','closing_date','program_id','departure_id',
    'room_type','pax','price_at_transaction','total_value','is_price_override',
    'price_note','payment_status','paid_amount','cancelled_at','cancel_reason',
    'province_id','city_id','address','interval_days','created_at','updated_at'
  ]) with ordinality as t(col, ordinality)
),
actual_view as (
  select a.attnum::int as pos, a.attname::text as col
  from pg_attribute a
  where a.attrelid = to_regclass('public.v_closings_cs') and a.attnum > 0 and not a.attisdropped
),
applied as (select to_regclass('public.capi_events') is not null as yes)
select * from (values
  -- 1. Sudah terpasang? Kalau ya, pemeriksaan lain hanya informatif.
  ('032_already_applied',
    case when (select yes from applied) then 'APPLIED' else 'ok' end,
    case when (select yes from applied) then '032 sudah terpasang di database ini; jangan pasang ulang tanpa alasan'
         else 'belum terpasang' end),

  -- 2. Migrasi sebelumnya sampai 031 benar-benar ada.
  ('027_app_users_whatsapp',
    case when exists(select 1 from information_schema.columns where table_schema='public' and table_name='app_users' and column_name='whatsapp') then 'ok' else 'FAIL' end,
    'kolom app_users.whatsapp'),
  ('028_export_gass_apps',
    case when exists(select 1 from pg_proc where proname='get_export_gass_apps') then 'ok' else 'FAIL' end,
    'fungsi get_export_gass_apps'),
  ('029_programs_policy',
    case when exists(select 1 from pg_policies where tablename='programs' and policyname='programs_brand_all') then 'ok' else 'FAIL' end,
    'policy programs_brand_all'),
  ('029_revalidate_fix',
    case when exists(select 1 from pg_proc where proname='revalidate_insight_totals' and prosrc like '%system_correction%') then 'ok' else 'FAIL' end,
    'revalidate_insight_totals punya bypass system_correction (fix error 500 closing)'),
  ('030_hrd_role',
    case when exists(select 1 from pg_enum e join pg_type t on t.oid=e.enumtypid where t.typname='user_role' and e.enumlabel='hrd') then 'ok' else 'FAIL' end,
    'enum user_role berisi hrd'),
  ('031_lead_reports_cs_delete',
    case when exists(select 1 from pg_policies where tablename='lead_reports' and policyname='lead_reports_cs_delete') then 'ok' else 'FAIL' end,
    'policy lead_reports_cs_delete'),

  -- 3. Objek yang dipakai 032.
  ('fn_current_brand_id',
    case when to_regprocedure('public.current_brand_id()') is not null then 'ok' else 'FAIL' end, 'fungsi current_brand_id()'),
  ('fn_current_app_role',
    case when to_regprocedure('public.current_app_role()') is not null then 'ok' else 'FAIL' end, 'fungsi current_app_role()'),
  ('fn_auth_uid',
    case when to_regprocedure('auth.uid()') is not null then 'ok' else 'FAIL' end, 'fungsi auth.uid()'),
  ('roles',
    case when (select count(*) from pg_roles where rolname in ('anon','authenticated','service_role')) = 3 then 'ok' else 'FAIL' end,
    'role anon, authenticated, service_role'),
  ('app_users_is_active',
    case when exists(select 1 from information_schema.columns where table_schema='public' and table_name='app_users' and column_name='is_active') then 'ok' else 'FAIL' end,
    'kolom app_users.is_active (dipakai policy CAPI)'),
  ('audit_logs_columns',
    case when (select count(*) from information_schema.columns where table_schema='public' and table_name='audit_logs'
      and column_name in ('brand_id','user_id','action','table_name','record_id','old_value','new_value')) = 7 then 'ok' else 'FAIL' end,
    'kolom audit_logs untuk audit pengaturan dan rekonsiliasi'),

  -- 4. View CS: create or replace view hanya boleh MENAMBAH kolom di ujung.
  ('v_closings_cs_definition',
    case
      when (select yes from applied) then 'APPLIED'
      when to_regclass('public.v_closings_cs') is null then 'FAIL'
      when (select count(*) from actual_view) <> 33 then 'FAIL'
      when exists(select 1 from expected_view e left join actual_view a using (pos) where a.col is distinct from e.col) then 'FAIL'
      else 'ok' end,
    'kolom v_closings_cs harus persis 33 kolom migrasi 013, urutan sama; kalau beda, view pernah diubah di luar migrasi'),

  -- 5. Tidak ada sisa objek CAPI dari percobaan manual (mis. tempel ke SQL Editor).
  ('no_partial_capi_objects',
    case
      when (select yes from applied) then 'APPLIED'
      when to_regclass('public.capi_settings') is not null or to_regclass('public.capi_worker_runs') is not null
        or exists(select 1 from pg_proc where proname in ('capi_settings_guard','capi_validate_payment_time','capi_queue_closing',
          'claim_capi_events','complete_capi_event','capi_settings_audit','capi_coverage','resolve_capi_event'))
        or exists(select 1 from pg_trigger where tgname like 'capi\_%' and not tgisinternal) then 'FAIL'
      else 'ok' end,
    'tidak ada tabel/fungsi/trigger capi_* yang tertinggal'),
  ('first_payment_column',
    case
      when not exists(select 1 from information_schema.columns where table_schema='public' and table_name='closings' and column_name='first_payment_received_at') then 'ok'
      when exists(select 1 from information_schema.columns where table_schema='public' and table_name='closings' and column_name='first_payment_received_at' and data_type='timestamp with time zone') then 'ok'
      else 'FAIL' end,
    'closings.first_payment_received_at belum ada, atau sudah timestamptz')
) as r(check_name, status, detail);

select * from capi_preflight;

do $$
declare n int;
begin
  select count(*) into n from capi_preflight where status = 'FAIL';
  if n > 0 then
    raise exception 'Preflight 032: % pemeriksaan FAIL — jangan pasang 032 dulu', n;
  end if;
end $$;

rollback;
