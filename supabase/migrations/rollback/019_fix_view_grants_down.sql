-- Rollback for 019_fix_view_grants.sql. Not auto-applied by Supabase CLI.
-- Restores the pre-fix (leaky) state -- only for emergency revert, do not
-- run this against a project with real data.

drop function if exists get_dashboard_overview(uuid,date,date,text,uuid,uuid);
drop function if exists get_campaign_quality(uuid,date,date,text);
drop function if exists get_cs_performance(uuid,date,date);
drop function if exists get_lead_insight_summary(uuid,date,date);

alter function _get_dashboard_overview_impl(uuid,date,date,text,uuid,uuid)
  rename to get_dashboard_overview;
alter function _get_campaign_quality_impl(uuid,date,date,text)
  rename to get_campaign_quality;
alter function _get_cs_performance_impl(uuid,date,date)
  rename to get_cs_performance;
alter function _get_lead_insight_summary_impl(uuid,date,date)
  rename to get_lead_insight_summary;

-- get_campaign_quality's body still points at _get_dashboard_overview_impl
-- by name (now renamed back to get_dashboard_overview) -- repoint it.
create or replace function get_campaign_quality(
  p_brand_id uuid, p_from date, p_to date, p_attribution text default 'cohort'
) returns table (
  campaign_id uuid, campaign_name text, spend bigint, meta_leads bigint, cpl_meta numeric,
  total_lead bigint, reached_consultation bigint, reached_offering bigint, closing bigint,
  closing_rate numeric, gross_profit bigint, cpp numeric, breakeven_cpp numeric, roi numeric
)
language sql stable
as $$
  select
    c.id as campaign_id, c.name as campaign_name,
    o.spend, o.meta_leads, o.cpl_meta, o.total_lead,
    o.reached_consultation, o.reached_offering, o.closing,
    o.closing::numeric / nullif(o.total_lead, 0) as closing_rate,
    o.gross_profit, o.cpp, o.breakeven_cpp, o.roi
  from ad_campaigns c
  cross join lateral get_dashboard_overview(p_brand_id, p_from, p_to, p_attribution, null, c.id) o
  where c.brand_id = p_brand_id
  order by o.roi desc nulls last;
$$;

grant execute on function get_dashboard_overview(uuid,date,date,text,uuid,uuid) to public;
grant execute on function get_campaign_quality(uuid,date,date,text) to public;
grant execute on function get_cs_performance(uuid,date,date) to public;
grant execute on function get_lead_insight_summary(uuid,date,date) to public;

grant all on v_closing_enriched  to anon, authenticated;
grant all on v_lead_funnel_daily to anon, authenticated;
grant all on v_ads_daily         to anon, authenticated;
grant all on v_closings_cs to anon, authenticated;
