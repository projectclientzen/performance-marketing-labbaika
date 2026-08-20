-- 019_fix_view_grants.sql
-- Fixes S0-01 (07-AUDIT-REPO.md): v_closing_enriched, v_lead_funnel_daily,
-- v_ads_daily were readable by `anon` over the public REST API with zero
-- auth — HPP and customer PII, proven with curl + the anon key. Two causes
-- stacked: Supabase's default privileges grant ALL on new public-schema
-- objects to anon/authenticated, and Postgres views run with the OWNER's
-- rights unless security_invoker is set, so RLS on the underlying
-- `closings` table was bypassed entirely.
--
-- v_closings_cs is NOT touched here beyond revoking its write/anon grants —
-- it already does this correctly on purpose (filters by cs_id = auth.uid(),
-- excludes cost columns). This migration closes the views that don't.

-- ---------------------------------------------------------------------------
-- Step 1: revoke direct access to the cost/PII-bearing views.
-- ---------------------------------------------------------------------------

revoke all on v_closing_enriched  from anon, authenticated;
revoke all on v_lead_funnel_daily from anon, authenticated;
revoke all on v_ads_daily         from anon, authenticated;

-- v_closings_cs is the deliberate cs read path (SELECT for authenticated
-- stays) but a view has no business being writable or anon-readable.
revoke all on v_closings_cs from anon;
revoke insert, update, delete, truncate, references, trigger
  on v_closings_cs from authenticated;

-- ---------------------------------------------------------------------------
-- Step 2+3: the 4 analytics functions read the now-locked-down views, so
-- they must run as their owner (SECURITY DEFINER) to keep working — but
-- DEFINER means they no longer inherit the caller's RLS, so each one must
-- check p_brand_id against the caller's own brand itself. Without this, a
-- cs could pass another brand's id and read its numbers.
--
-- Approach: rename each original migration-016/018 function to *_impl
-- (body untouched, still `language sql` — no PL/pgSQL variable scoping
-- involved there) and add a thin `language plpgsql security definer`
-- wrapper under the original public name that does the guard, then calls
-- the impl. Tried folding the guard directly into a rewritten plpgsql
-- version of each big query first; every one of them failed with
-- "column reference is ambiguous" because RETURNS TABLE column names
-- (total_lead, cold, gross_profit, spend, ...) become PL/pgSQL variables
-- in scope for the whole function body, colliding with identically-named
-- source columns in the SQL text — even inside CTEs. A qualified alias on
-- the impl's result set (`imp.total_lead`, not bare `total_lead`) sidesteps
-- that; keeping the heavy SQL untouched in a `language sql` impl sidesteps
-- it entirely, which is simpler and touches less of the working logic.
-- ---------------------------------------------------------------------------

alter function get_dashboard_overview(uuid,date,date,text,uuid,uuid)
  rename to _get_dashboard_overview_impl;
alter function get_campaign_quality(uuid,date,date,text)
  rename to _get_campaign_quality_impl;
alter function get_cs_performance(uuid,date,date)
  rename to _get_cs_performance_impl;
alter function get_lead_insight_summary(uuid,date,date)
  rename to _get_lead_insight_summary_impl;

-- get_campaign_quality's impl calls get_dashboard_overview by name via
-- LATERAL — that call now resolves to the renamed _impl only if we point
-- it there explicitly, otherwise it'd hit the new guarded wrapper and
-- double-guard (harmless but redundant). Repoint it at the impl.
create or replace function _get_campaign_quality_impl(
  p_brand_id uuid, p_from date, p_to date, p_attribution text default 'cohort'
) returns table (
  campaign_id uuid, campaign_name text, spend bigint, meta_leads bigint, cpl_meta numeric,
  total_lead bigint, reached_consultation bigint, reached_offering bigint, closing bigint,
  closing_rate numeric, gross_profit bigint, cpp numeric, breakeven_cpp numeric, roi numeric
)
language sql
stable
as $$
  select
    c.id as campaign_id, c.name as campaign_name,
    o.spend, o.meta_leads, o.cpl_meta, o.total_lead,
    o.reached_consultation, o.reached_offering, o.closing,
    o.closing::numeric / nullif(o.total_lead, 0) as closing_rate,
    o.gross_profit, o.cpp, o.breakeven_cpp, o.roi
  from ad_campaigns c
  cross join lateral _get_dashboard_overview_impl(p_brand_id, p_from, p_to, p_attribution, null, c.id) o
  where c.brand_id = p_brand_id
  order by o.roi desc nulls last;
$$;

-- ---------------------------------------------------------------------------
-- Public wrappers: guard + (for cs performance) profit masking, then
-- delegate to the impl via a qualified alias.
-- ---------------------------------------------------------------------------

create function get_dashboard_overview(
  p_brand_id uuid,
  p_from date,
  p_to date,
  p_attribution text default 'cash',
  p_source_id uuid default null,
  p_campaign_id uuid default null
) returns table (
  spend bigint,
  meta_leads bigint,
  cpl_meta numeric,
  total_lead bigint,
  cold bigint,
  consultation bigint,
  offering bigint,
  closing bigint,
  reached_consultation bigint,
  reached_offering bigint,
  reached_closing bigint,
  gross_booking_value bigint,
  collected_revenue bigint,
  cancellation_rate numeric,
  gross_profit bigint,
  margin_pct numeric,
  net_contribution bigint,
  roi numeric,
  cpp numeric,
  breakeven_cpp numeric,
  ad_cost_ratio numeric,
  cost_coverage_rate numeric,
  median_closing_interval_days numeric,
  campaign_attribution_rate numeric
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

  return query
  select imp.* from _get_dashboard_overview_impl(
    p_brand_id, p_from, p_to, p_attribution, p_source_id, p_campaign_id
  ) as imp;
end;
$$;

create function get_campaign_quality(
  p_brand_id uuid,
  p_from date,
  p_to date,
  p_attribution text default 'cohort'
) returns table (
  campaign_id uuid,
  campaign_name text,
  spend bigint,
  meta_leads bigint,
  cpl_meta numeric,
  total_lead bigint,
  reached_consultation bigint,
  reached_offering bigint,
  closing bigint,
  closing_rate numeric,
  gross_profit bigint,
  cpp numeric,
  breakeven_cpp numeric,
  roi numeric
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

  return query
  select imp.* from _get_campaign_quality_impl(p_brand_id, p_from, p_to, p_attribution) as imp;
end;
$$;

-- gross_profit/gross_booking_value are masked to NULL unless the caller is
-- owner: 02-PRD-v1.3.md §4 — cs does not see HPP, margin, ROI, or company
-- revenue. Proven leaking pre-fix: a cs session calling this function got
-- back gross_profit = 3948000, which combined with the known list price
-- (price - gross_profit = cost) reverse-computes HPP.
create function get_cs_performance(
  p_brand_id uuid,
  p_from date,
  p_to date
) returns table (
  cs_id uuid,
  cs_name text,
  total_lead bigint,
  cold bigint,
  consultation bigint,
  offering bigint,
  closing bigint,
  gross_booking_value bigint,
  gross_profit bigint,
  avg_closing_interval numeric,
  median_closing_interval numeric,
  cancellation_rate numeric,
  report_days bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_is_owner boolean;
begin
  if p_brand_id is distinct from current_brand_id() then
    raise exception 'akses ditolak untuk brand tersebut' using errcode = '42501';
  end if;

  v_is_owner := current_app_role() = 'owner';

  return query
  select
    imp.cs_id, imp.cs_name, imp.total_lead, imp.cold, imp.consultation, imp.offering, imp.closing,
    case when v_is_owner then imp.gross_booking_value else null end,
    case when v_is_owner then imp.gross_profit else null end,
    imp.avg_closing_interval, imp.median_closing_interval, imp.cancellation_rate, imp.report_days
  from _get_cs_performance_impl(p_brand_id, p_from, p_to) as imp
  order by case when v_is_owner then coalesce(imp.gross_profit, 0) else 0 end desc;
end;
$$;

create function get_lead_insight_summary(
  p_brand_id uuid,
  p_from date,
  p_to date
) returns table (
  category_id uuid,
  category_name text,
  lead_count bigint,
  pct_of_filled numeric,
  pct_of_total_lead numeric
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

  return query
  select imp.* from _get_lead_insight_summary_impl(p_brand_id, p_from, p_to) as imp;
end;
$$;

-- ---------------------------------------------------------------------------
-- Defense in depth: Postgres grants EXECUTE to PUBLIC by default, which
-- anon/authenticated inherit -- confirmed anon could call all 4 functions
-- before this migration. The p_brand_id guard above already rejects an
-- unauthenticated caller (current_brand_id() is NULL for anon, never
-- matches a real brand id), but there's no reason anon should be able to
-- invoke these at all. The _impl functions get no grants at all — they're
-- only reachable through the guarded wrappers.
-- ---------------------------------------------------------------------------

revoke execute on function get_dashboard_overview(uuid,date,date,text,uuid,uuid) from public, anon;
revoke execute on function get_campaign_quality(uuid,date,date,text) from public, anon;
revoke execute on function get_cs_performance(uuid,date,date) from public, anon;
revoke execute on function get_lead_insight_summary(uuid,date,date) from public, anon;

grant execute on function get_dashboard_overview(uuid,date,date,text,uuid,uuid) to authenticated;
grant execute on function get_campaign_quality(uuid,date,date,text) to authenticated;
grant execute on function get_cs_performance(uuid,date,date) to authenticated;
grant execute on function get_lead_insight_summary(uuid,date,date) to authenticated;

revoke execute on function _get_dashboard_overview_impl(uuid,date,date,text,uuid,uuid) from public, anon, authenticated;
revoke execute on function _get_campaign_quality_impl(uuid,date,date,text) from public, anon, authenticated;
revoke execute on function _get_cs_performance_impl(uuid,date,date) from public, anon, authenticated;
revoke execute on function _get_lead_insight_summary_impl(uuid,date,date) from public, anon, authenticated;
