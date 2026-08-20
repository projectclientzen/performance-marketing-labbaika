-- Rollback untuk 026_restore_analytics_impl.sql. Tidak dijalankan otomatis.
--
-- 026 hanya memulihkan objek yang seharusnya sudah ada sejak migrasi 023 —
-- view v_closing_enriched dan tiga fungsi _impl. Membalikkannya berarti
-- mengembalikan produksi ke keadaan rusak: wrapper publik tetap ada dan tetap
-- memanggil impl yang hilang, sehingga Dashboard Overview, Campaign Quality,
-- dan CS Performance kembali membalas 500.
--
-- Tidak ada alasan sah menjalankan ini. Disediakan hanya supaya tiap migrasi
-- punya pasangan rollback sesuai konvensi repo.

drop function if exists _get_cs_performance_impl(uuid,date,date);
drop function if exists _get_campaign_quality_impl(uuid,date,date,text);
drop function if exists _get_dashboard_overview_impl(uuid,date,date,text,uuid,uuid);
drop view if exists v_closing_enriched;
