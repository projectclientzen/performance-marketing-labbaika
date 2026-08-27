-- Rollback 030 — kembalikan owner-access ke owner+advertiser saja.
-- Nilai enum 'hrd' TIDAK dihapus (Postgres tidak mendukung drop enum value
-- dengan aman); cukup keluarkan dari fungsi akses. User ber-role hrd yang
-- tersisa akan kehilangan akses owner-level.
create or replace function current_has_owner_access() returns boolean
language sql stable security definer set search_path = public
as $$
  select current_app_role()::text in ('owner', 'advertiser')
$$;
