-- 031 — CS boleh menghapus laporan hariannya sendiri.
--
-- FE (app/cs/laporan) sudah punya tombol Hapus, tapi lead_reports tidak punya
-- policy DELETE untuk CS (hanya select/insert/update). Akibatnya DELETE oleh CS
-- diam-diam mengenai 0 baris tanpa error — UI mengiranya berhasil, lalu
-- laporannya muncul lagi saat refresh. Policy ini menutup celah itu, dibatasi
-- ke laporan milik CS sendiri dan brand-nya, sama seperti cs_update.
--
-- Owner/advertiser/hrd sudah bisa menghapus lewat lead_reports_owner_all.

begin;

drop policy if exists lead_reports_cs_delete on lead_reports;
create policy lead_reports_cs_delete on lead_reports for delete
  using (brand_id = current_brand_id() and cs_id = auth.uid());

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'lead_reports' and policyname = 'lead_reports_cs_delete') then
    raise exception '031: lead_reports_cs_delete tidak terbentuk';
  end if;
end $$;

commit;
