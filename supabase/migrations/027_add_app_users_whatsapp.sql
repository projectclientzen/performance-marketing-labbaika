-- 027_add_app_users_whatsapp.sql
-- Keputusan produk (Maszen, 20 Agustus 2026): F-13 Export Gass Apps butuh
-- nomor WA per CS di tiap baris export, dan F-19's "+ Tambah user" form
-- (10-AUDIT-FE-BE.md #15, sudah lama menganggur karena POST /api/users
-- belum ada) butuh menyimpannya saat identitas dibuat.
--
-- app_users tidak punya kolom kontak sama sekali sebelum ini -- cuma
-- id/brand_id/full_name/role/is_active/created_at (001_enums_and_master.sql).
-- email sengaja TIDAK ditambah di sini: email sudah hidup di auth.users dan
-- 047865c sudah membangun jalur pengambilannya (service role, sempit, cuma
-- mengisi kolom untuk baris yang sudah lolos RLS pada app_users). Menyimpan
-- email di dua tempat adalah cara memastikan keduanya diam-diam berbeda
-- dalam sebulan.
--
-- Disimpan E.164 (format sama dengan closings.whatsapp_e164) supaya
-- konsisten dengan satu-satunya sumber nomor WA lain di sistem ini --
-- diisi lewat lib/utils/phone.ts normalizePhoneID() di sisi aplikasi, bukan
-- divalidasi di database (pola yang sama dipakai closings: kolom nullable,
-- normalisasi format hidup di TypeScript).
--
-- Idempotent (if not exists) dan dibungkus transaksi -- pelajaran dari 023,
-- yang terpasang separuh karena dijalankan tanpa BEGIN/COMMIT lewat SQL
-- Editor dan gagal diam-diam di tengah jalan.

begin;

alter table app_users add column if not exists whatsapp text;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'app_users' and column_name = 'whatsapp'
  ) then
    raise exception '027 GAGAL: kolom app_users.whatsapp tidak ada setelah migrasi';
  end if;
  raise notice '027 OK: app_users.whatsapp ada';
end $$;

commit;
