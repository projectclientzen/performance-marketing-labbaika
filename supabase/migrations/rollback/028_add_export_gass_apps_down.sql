-- Rollback untuk 028_add_export_gass_apps.sql. Tidak dijalankan otomatis.
-- Hanya menghapus fungsi -- tidak ada data yang hilang, cuma jalur export
-- Gass Apps (F-13) yang mati sampai migrasinya dipasang ulang.

drop function if exists get_export_gass_apps(uuid,date,date,int,int);
