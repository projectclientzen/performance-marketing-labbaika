-- 028_add_export_gass_apps.sql
-- F-13 Export Gass Apps (10-AUDIT-FE-BE.md §25, keputusan produk Maszen 20
-- Agustus): "ini skemanya ambil dari closingan per cs ... nomor wa cs".
-- Prototype (docs/labbaika-reporting.html) shows this as copy-to-clipboard,
-- not a file download, format "Purchase" (Meta/Gass Apps conversion-event
-- shape): ID, Phone Number, CS Phone Number, Value.
--
-- Same shape as 021's get_export_operational/get_export_meta_ltv: a
-- SECURITY DEFINER function guarded on brand AND owner-level access
-- (export rows carry raw customer PII — whatsapp, unhashed, unlike the
-- Meta export — same reasoning 021's comment gives), paginated via
-- p_offset/p_limit so the route can stream instead of loading everything
-- into memory.
--
-- Guard uses current_has_owner_access(), not `current_app_role() = 'owner'`
-- -- 024 added the advertiser role with owner-level access and rewrote
-- every guard to this helper. Copying 021's original guard verbatim would
-- have locked Maszen himself out (he's advertiser, not owner).
--
-- cs_whatsapp comes from app_users.whatsapp (027) via cs_id -- nullable,
-- since it's not backfilled for any existing CS yet (027 only added the
-- column). Rows with a null cs_whatsapp are still returned, not filtered
-- out -- the closing data is correct, only the CS's number is missing.
-- The route/FE surfaces that count rather than silently shrinking the
-- export.
--
-- payment_status <> 'cancelled': this export is framed as a "Purchase"
-- event -- a cancelled closing isn't a purchase. Unlike meta-ltv (021),
-- pdp_consent is NOT required here -- Gass Apps is a WhatsApp CRM/comms
-- tool the CS's own conversation already exists in, not a Meta ad
-- audience upload, so the PDP-for-advertising gate (04-BRIEF-BE.md §14.2)
-- doesn't apply to it. Flagging the distinction in case that reasoning
-- turns out to be wrong -- Maszen's instruction didn't specify.
--
-- Transaction-wrapped + closes with a raise-exception verification block,
-- per the pattern 025-027 settled on after 023 landed half-applied from
-- being run outside a transaction.

begin;

-- `create or replace`, bukan `create` polos: migrasi di proyek ini dijalankan
-- dengan menempel isinya ke SQL Editor, dan sudah dua kali ada yang terpasang
-- separuh lalu diulang. Versi pertama berkas ini gagal di percobaan kedua
-- dengan "function already exists" — artinya perbaikan setelah kegagalan
-- parsial jadi mustahil tanpa drop manual lebih dulu.

create or replace function get_export_gass_apps(
  p_brand_id uuid,
  p_from date default null,
  p_to date default null,
  p_offset int default 0,
  p_limit int default 1000
) returns table (
  id uuid,
  phone text,
  cs_whatsapp text,
  value bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_brand_id is distinct from current_brand_id() then
    raise exception 'akses ditolak untuk brand tersebut' using errcode = '42501';
  end if;
  if not current_has_owner_access() then
    raise exception 'akses ditolak: hanya owner/advertiser' using errcode = '42501';
  end if;

  return query
  select
    c.id,
    c.whatsapp_e164,
    u.whatsapp,
    c.total_value
  from closings c
  join app_users u on u.id = c.cs_id
  where c.brand_id = p_brand_id
    and c.payment_status <> 'cancelled'
    and (p_from is null or c.closing_date >= p_from)
    and (p_to is null or c.closing_date <= p_to)
  order by c.closing_date desc, c.id
  offset p_offset limit p_limit;
end;
$$;

revoke execute on function get_export_gass_apps(uuid,date,date,int,int) from public, anon;
grant execute on function get_export_gass_apps(uuid,date,date,int,int) to authenticated;

do $$
begin
  if to_regprocedure('public.get_export_gass_apps(uuid,date,date,int,int)') is null then
    raise exception '028 GAGAL: get_export_gass_apps tidak ada setelah migrasi';
  end if;
  if has_function_privilege('anon', 'get_export_gass_apps(uuid,date,date,int,int)', 'execute') then
    raise exception '028 GAGAL: anon masih punya EXECUTE pada get_export_gass_apps';
  end if;
  raise notice '028 OK: get_export_gass_apps ada, anon ditolak';
end $$;

commit;
