-- Rollback untuk 027_add_app_users_whatsapp.sql. Tidak dijalankan otomatis.
--
-- PERINGATAN: ini MENGHAPUS DATA. Setiap nomor WhatsApp CS yang sudah terisi
-- hilang permanen, dan tidak ada salinannya di tempat lain — `closings`
-- menyimpan nomor jamaah, bukan nomor CS. Satu-satunya cara mengembalikannya
-- adalah restore dari backup Supabase, atau mengetik ulang seluruhnya.
--
-- Selamatkan dulu kalau kolomnya sudah dipakai:
--
--   select id, full_name, whatsapp from app_users where whatsapp is not null;
--
-- Konsekuensi lain: Export Gass Apps (F-13) kehilangan kolom nomor WA-nya, dan
-- form tambah user di F-19 akan menolak insert kalau kodenya belum ikut
-- dikembalikan ke versi sebelum 027.

alter table app_users drop column if exists whatsapp;
