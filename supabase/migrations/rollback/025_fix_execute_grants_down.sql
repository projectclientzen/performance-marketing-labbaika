-- Rollback untuk 025_fix_execute_grants.sql. Tidak dijalankan otomatis.
--
-- Mengembalikan keadaan sebelum 025: anon tidak boleh memanggil
-- current_has_owner_access(). Perlu diingat konsekuensinya -- itulah yang
-- membuat query anon ke tabel ber-policy membalas error 42501 alih-alih nol
-- baris. Jangan dijalankan kecuali memang itu yang diinginkan.
--
-- Pencabutan EXECUTE pada enam fungsi analitik/export TIDAK dibalik: itu
-- keadaan yang benar sejak migrasi 019/021/023, dan 025 hanya menegaskannya
-- ulang. Membalikkannya berarti membuka akses yang memang tidak seharusnya ada.
--
-- Pembuangan trigger HPP juga tidak dibalik: jalur biayanya sudah tidak ada
-- sejak 023, jadi mengembalikan trigger justru merusak setiap insert closing.

revoke execute on function current_has_owner_access() from anon;
