-- Rollback untuk 024_advertiser_role.sql. Tidak dijalankan otomatis.
--
-- PERINGATAN: Postgres tidak bisa membuang nilai dari enum yang sudah ada.
-- `advertiser` akan tetap ada di tipe `user_role` selamanya. Yang bisa
-- dikembalikan hanya perilakunya.
--
-- Sebelum menjalankan berkas ini, pindahkan dulu setiap pengguna advertiser --
-- kalau tidak, mereka kehilangan seluruh akses tanpa jejak, karena policy di
-- bawah kembali menuntut 'owner' persis:
--
--   select id, full_name from app_users where role::text = 'advertiser';
--   update app_users set role = 'owner' where role::text = 'advertiser';
--
-- Cara paling sederhana mengembalikan perilaku lama tanpa membuat ulang 21
-- policy: sempitkan fungsi bantunya. Policy tetap memanggil
-- current_has_owner_access(), tapi fungsinya berhenti mengakui advertiser.

create or replace function current_has_owner_access() returns boolean
language sql stable security definer set search_path = public
as $$
  select current_app_role()::text = 'owner'
$$;

comment on function current_has_owner_access() is
  'DI-ROLLBACK: hanya owner. advertiser tidak lagi diakui.';

-- Pesan penolakan di keenam fungsi masih menyebut "owner/advertiser". Itu
-- kosmetik dan sengaja dibiarkan -- menjalankan ulang 021 dan 023 secara
-- berurutan akan mengembalikan kalimat aslinya kalau memang dipermasalahkan.
