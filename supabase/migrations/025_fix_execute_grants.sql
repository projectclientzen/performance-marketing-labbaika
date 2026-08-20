-- 025_fix_execute_grants.sql
-- Dua perbaikan kecil, keduanya ditemukan dengan memeriksa database live
-- setelah 023 dan 024 dipasang, bukan dari membaca kode.
--
-- Seluruh isi berkas ini idempotent dan aman dijalankan ulang.

-- ---------------------------------------------------------------------------
-- 1. anon perlu boleh MEMANGGIL current_has_owner_access().
--
-- Migrasi 024 mencabut EXECUTE-nya dari anon. Niatnya baik tapi salah sasaran:
-- fungsi ini dipanggil dari DALAM policy RLS, jadi mencabutnya membuat query
-- anon ke tabel ber-policy GAGAL dengan
--   "permission denied for function current_has_owner_access"
-- alih-alih membalas nol baris seperti sebelumnya. Terlihat langsung di live:
-- `GET /rest/v1/closings` sebagai anon dulu membalas `[]`, sesudah 024 membalas
-- error 42501.
--
-- Dua saudaranya, current_brand_id() dan current_app_role() (migrasi 013),
-- tidak pernah dicabut dari anon justru karena alasan yang sama. 024 membuat
-- fungsi ketiga ini tidak konsisten dengan keduanya.
--
-- Membiarkan anon memanggilnya tidak membocorkan apa pun: fungsinya membaca
-- current_app_role(), yang bersandar pada auth.uid(), yang NULL untuk anon --
-- jadi hasilnya selalu NULL. Yang menjaga data tetap policy RLS-nya sendiri.
grant execute on function current_has_owner_access() to anon;

-- ---------------------------------------------------------------------------
-- 2. Tegaskan ulang pencabutan EXECUTE pada enam fungsi analitik/export.
--
-- Menjalankan 001-024 ke database bersih menghasilkan anon = false untuk
-- keenamnya (diperiksa lewat has_function_privilege). Tapi di project live anon
-- justru sampai ke badan fungsinya -- terbukti dari pesan yang diterima anon:
-- "akses ditolak untuk brand tersebut" (dari dalam badan fungsi), bukan
-- "permission denied for function" (dari pemeriksaan grant).
--
-- Jadi ada penyimpangan antara isi berkas migrasi dan keadaan database, entah
-- karena urutan penerapan atau default privilege project yang menggrant ulang.
-- Sebabnya tidak bisa dipastikan dari luar; yang bisa dilakukan adalah
-- menegaskan ulang keadaan yang diinginkan.
--
-- Perlu ditegaskan: ini lapis pertahanan tambahan, BUKAN kebocoran. Sudah
-- diuji terhadap live dengan brand_id asli -- anon tetap ditolak guard di dalam
-- fungsi, karena current_brand_id() bernilai NULL untuk anon sehingga tidak
-- pernah cocok dengan brand mana pun. Tidak ada satu baris data pun yang
-- keluar. Yang diperbaiki di sini adalah lapisan yang seharusnya menolak lebih
-- awal, sebelum badan fungsi sempat berjalan.
revoke execute on function get_dashboard_overview(uuid,date,date,text,uuid,uuid) from public, anon;
revoke execute on function get_campaign_quality(uuid,date,date,text) from public, anon;
revoke execute on function get_cs_performance(uuid,date,date) from public, anon;
revoke execute on function get_lead_insight_summary(uuid,date,date) from public, anon;
revoke execute on function get_export_operational(uuid,date,date,uuid,uuid,uuid,payment_status,int,int) from public, anon;
revoke execute on function get_export_meta_ltv(uuid,date,date,int,int) from public, anon;

grant execute on function get_dashboard_overview(uuid,date,date,text,uuid,uuid) to authenticated;
grant execute on function get_campaign_quality(uuid,date,date,text) to authenticated;
grant execute on function get_cs_performance(uuid,date,date) to authenticated;
grant execute on function get_lead_insight_summary(uuid,date,date) to authenticated;
grant execute on function get_export_operational(uuid,date,date,uuid,uuid,uuid,payment_status,int,int) to authenticated;
grant execute on function get_export_meta_ltv(uuid,date,date,int,int) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Jaring pengaman: pastikan trigger HPP benar-benar hilang.
--
-- Versi pertama migrasi 023 membuang nama trigger yang salah, dan karena
-- dibungkus `if exists` Postgres diam saja (10-AUDIT-FE-BE.md #22). Kalau yang
-- terlanjur dijalankan ke live adalah versi itu, trigger `trg_b3_lock_cost_at_closing`
-- masih hidup dan SETIAP insert closing akan gagal dengan
--   'relation "program_costs" does not exist'
-- Belum ketahuan karena tabel closings masih kosong -- CS pertama yang menyimpan
-- closing yang akan menemukannya.
--
-- Aman dijalankan meskipun 023 versi perbaikan yang dipakai: kalau sudah tidak
-- ada, kedua statement ini tidak melakukan apa-apa. Blok verifikasi di bawah
-- yang memastikan hasil akhirnya benar, apa pun jalur yang ditempuh.
drop trigger if exists trg_b3_lock_cost_at_closing on closings;
drop function if exists lock_cost_at_closing();

do $$
declare v_sisa text;
begin
  select string_agg(proname, ', ') into v_sisa
  from pg_proc where prosrc like '%program_costs%';
  if v_sisa is not null then
    raise exception 'masih ada fungsi yang menyebut program_costs: %', v_sisa;
  end if;

  if to_regclass('public.program_costs') is not null then
    raise exception 'tabel program_costs masih ada';
  end if;

  raise notice '025 OK: tidak ada sisa jalur HPP di database';
end $$;
