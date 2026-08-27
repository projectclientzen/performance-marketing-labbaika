-- 030 — Peran HRD, setara owner/advertiser (sementara, sampai UI/UX khusus HRD).
--
-- Pola sama persis dengan penambahan `advertiser` di migrasi 024: satu nilai
-- enum baru, lalu `current_has_owner_access()` diperluas agar HRD ikut lolos
-- semua policy & guard yang memakai fungsi itu. `current_app_role()` tetap
-- mengembalikan peran sebenarnya (untuk audit & manajemen user).
--
-- Cermin TypeScript-nya di lib/auth/roles.ts (OWNER_LEVEL) HARUS selalu sepakat
-- dengan fungsi ini.
--
-- Catatan: ALTER TYPE ... ADD VALUE sengaja TIDAK dibungkus transaksi bersama
-- pemakaiannya. Di sini aman karena fungsi hanya membandingkan `::text`, bukan
-- memakai 'hrd' sebagai literal enum.

alter type user_role add value if not exists 'hrd';

create or replace function current_has_owner_access() returns boolean
language sql stable security definer set search_path = public
as $$
  select current_app_role()::text in ('owner', 'advertiser', 'hrd')
$$;

comment on function current_has_owner_access() is
  'True untuk owner, advertiser, dan hrd. Dipakai seluruh policy dan guard yang dulu menulis current_app_role() = ''owner''. Bukan pengganti current_app_role(), yang tetap mengembalikan peran sebenarnya untuk audit dan manajemen user.';

do $$
begin
  if not exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
                 where t.typname = 'user_role' and e.enumlabel = 'hrd') then
    raise exception '030: nilai enum user_role ''hrd'' tidak terbentuk';
  end if;
end $$;
