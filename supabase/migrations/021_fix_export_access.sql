-- 021_fix_export_access.sql
-- Fixes 10-AUDIT-FE-BE.md #1: Export Center broke as a direct regression of
-- 019_fix_view_grants.sql. Both export routes read v_closing_enriched with
-- the caller's own anon-key client (role `authenticated`) -- exactly the
-- role 019 revoked from that view, since it carries HPP/PII. Owner presses
-- either export button and gets an error, not a CSV.
--
-- Same shape as 019's fix: a SECURITY DEFINER function stands in for the
-- direct view read. Guard is stricter here than the 4 analytics functions
-- in 019 -- those only check p_brand_id against current_brand_id(). Export
-- rows carry cost_at_transaction-derived fields and raw PII (whatsapp,
-- email), so the guard also requires current_app_role() = 'owner'. Routes
-- already reject non-owner callers before reaching Postgres, but that check
-- living only in TypeScript is exactly the failure mode 019's comment
-- warns about -- RLS (or here, an equivalent DB-side guard) is the actual
-- backstop.
--
-- Both routes stream via ReadableStream, paging .range(offset, offset+999)
-- to keep memory flat at 50k+ rows (CC-B24, exports/operational/route.ts:8).
-- These functions keep that shape: p_offset/p_limit, one page per call, the
-- route's existing loop-until-empty logic is unchanged.

create function get_export_operational(
  p_brand_id uuid,
  p_from date default null,
  p_to date default null,
  p_cs uuid default null,
  p_program uuid default null,
  p_source uuid default null,
  p_status payment_status default null,
  p_offset int default 0,
  p_limit int default 1000
) returns table (
  lead_date date,
  name text,
  whatsapp text,
  city text,
  source_id uuid,
  stage text,
  closing_date date,
  program text,
  room_type room_type,
  pax int,
  total_value bigint,
  paid_amount bigint,
  status payment_status
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
  if current_app_role() <> 'owner' then
    raise exception 'akses ditolak: hanya owner' using errcode = '42501';
  end if;

  return query
  select
    c.lead_date,
    trim(concat_ws(' ', c.first_name, c.last_name)),
    c.whatsapp_e164,
    r_city.name,
    c.source_id,
    'closing'::text,
    c.closing_date,
    p.name,
    c.room_type,
    c.pax,
    c.total_value,
    c.paid_amount,
    c.payment_status
  from closings c
  join programs p on p.id = c.program_id
  left join regions r_city on r_city.id = c.city_id
  where c.brand_id = p_brand_id
    and (p_from is null or c.closing_date >= p_from)
    and (p_to is null or c.closing_date <= p_to)
    and (p_cs is null or c.cs_id = p_cs)
    and (p_program is null or c.program_id = p_program)
    and (p_source is null or c.source_id = p_source)
    and (p_status is null or c.payment_status = p_status)
  order by c.closing_date desc
  offset p_offset limit p_limit;
end;
$$;

-- PDP consent gate is load-bearing here, not cosmetic (04-BRIEF-BE.md
-- §14.2): only closings where the lead consented go to Meta.
create function get_export_meta_ltv(
  p_brand_id uuid,
  p_from date default null,
  p_to date default null,
  p_offset int default 0,
  p_limit int default 1000
) returns table (
  phone text,
  email text,
  name text,
  city text,
  state text,
  total_value bigint
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
  if current_app_role() <> 'owner' then
    raise exception 'akses ditolak: hanya owner' using errcode = '42501';
  end if;

  return query
  select
    c.whatsapp_e164,
    c.email,
    trim(concat_ws(' ', c.first_name, c.last_name)),
    r_city.name,
    r_prov.name,
    c.total_value
  from closings c
  left join regions r_city on r_city.id = c.city_id
  left join regions r_prov on r_prov.id = c.province_id
  where c.brand_id = p_brand_id
    and c.pdp_consent = true
    and c.payment_status <> 'cancelled'
    and (p_from is null or c.closing_date >= p_from)
    and (p_to is null or c.closing_date <= p_to)
  order by c.closing_date desc
  offset p_offset limit p_limit;
end;
$$;

-- Same defense-in-depth as 019: Postgres grants EXECUTE to PUBLIC by
-- default, which anon/authenticated inherit. The role guard above already
-- rejects non-owner callers, but there's no reason anon should reach these
-- at all.
revoke execute on function get_export_operational(uuid,date,date,uuid,uuid,uuid,payment_status,int,int) from public, anon;
revoke execute on function get_export_meta_ltv(uuid,date,date,int,int) from public, anon;

grant execute on function get_export_operational(uuid,date,date,uuid,uuid,uuid,payment_status,int,int) to authenticated;
grant execute on function get_export_meta_ltv(uuid,date,date,int,int) to authenticated;
