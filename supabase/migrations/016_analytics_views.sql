-- 016_analytics_views.sql
-- CC-B20/B21/B22 support: analytics views + dashboard aggregate function.
-- Ref: 04-BRIEF-BE.md §5, 02-PRD-v1.3.md §9-§11.
--
-- All rate/ratio math lives here, not in TypeScript ("Kalau ada rumus
-- conversion rate ditulis di TypeScript, itu bug" — 04-BRIEF-BE.md §1).
-- Every division uses NULLIF to avoid divide-by-zero.
--
-- Meta Ads data currently comes from ad_performance (manual/CSV import,
-- CC-B26) rather than a live API — 02-PRD-v1.3.md §21 defers automatic
-- Meta Ads API sync to Phase 2 via Hermes as orchestrator. These views
-- don't care where ad_performance rows came from, so nothing here needs
-- to change when that integration lands.

create view v_lead_funnel_daily as
select
  brand_id, report_date, cs_id, source_id, campaign_id,
  total_lead, cold, consultation, offering, closing,
  (consultation + offering + closing) as reached_consultation,
  (offering + closing) as reached_offering,
  closing as reached_closing
from lead_reports;

-- Row-level closing facts joined with dimensions. Owner-only via RLS on the
-- base table (cs reads v_closings_cs instead, migration 013) — this view
-- includes cost_of_sales/gross_profit, so it must never be exposed to cs.
create view v_closing_enriched as
select
  c.*,
  (c.payment_status = 'cancelled') as is_cancelled,
  case when c.payment_status <> 'cancelled' then c.total_value else 0 end as revenue_gross,
  p.name as program_name,
  d.departure_date,
  r_prov.name as province_name,
  r_city.name as city_name,
  u.full_name as cs_name
from closings c
join programs p on p.id = c.program_id
join program_departures d on d.id = c.departure_id
left join regions r_prov on r_prov.id = c.province_id
left join regions r_city on r_city.id = c.city_id
join app_users u on u.id = c.cs_id;

create view v_ads_daily as
select
  brand_id, level, entity_id, date,
  spend, impressions, reach, clicks, leads,
  clicks::numeric / nullif(impressions, 0) as ctr,
  spend::numeric / nullif(clicks, 0) as cpc,
  spend::numeric / nullif(impressions, 0) * 1000 as cpm,
  spend::numeric / nullif(leads, 0) as cpl_meta
from ad_performance;

-- Dashboard Owner Overview (F-07) and the numerator for Campaign Quality
-- (F-08) rows. Attribution mode picks whether closings are grouped by
-- closing_date (cash, default) or lead_date (cohort) — 02-PRD-v1.3.md §9.4.
-- Ad spend is always attributed by campaign for the period regardless of
-- attribution mode; only revenue/profit timing changes.
create or replace function get_dashboard_overview(
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
language sql
stable
as $$
  with lead_agg as (
    select
      coalesce(sum(total_lead), 0)::bigint as total_lead,
      coalesce(sum(cold), 0)::bigint as cold,
      coalesce(sum(consultation), 0)::bigint as consultation,
      coalesce(sum(offering), 0)::bigint as offering,
      coalesce(sum(closing), 0)::bigint as closing,
      coalesce(sum(consultation + offering + closing), 0)::bigint as reached_consultation,
      coalesce(sum(offering + closing), 0)::bigint as reached_offering,
      coalesce(sum(closing), 0)::bigint as reached_closing,
      coalesce(sum(total_lead) filter (where campaign_id is not null), 0)::numeric
        / nullif(sum(total_lead), 0) as campaign_attribution_rate
    from lead_reports
    where brand_id = p_brand_id
      and report_date between p_from and p_to
      and (p_source_id is null or source_id = p_source_id)
      and (p_campaign_id is null or campaign_id = p_campaign_id)
  ),
  closing_agg as (
    select
      coalesce(sum(revenue_gross), 0)::bigint as gross_booking_value,
      coalesce(sum(paid_amount) filter (where payment_status <> 'cancelled'), 0)::bigint as collected_revenue,
      coalesce(sum(gross_profit) filter (where payment_status <> 'cancelled'), 0)::bigint as gross_profit,
      count(*) filter (where payment_status <> 'cancelled') as closing_count,
      count(*) filter (where payment_status = 'cancelled') as cancelled_count,
      count(*) as total_count,
      coalesce(sum(revenue_gross) filter (where cost_source = 'actual'), 0)::numeric
        / nullif(sum(revenue_gross), 0) as cost_coverage_rate,
      percentile_cont(0.5) within group (order by interval_days)
        filter (where payment_status <> 'cancelled') as median_interval
    from v_closing_enriched
    where brand_id = p_brand_id
      and (case when p_attribution = 'cohort' then lead_date else closing_date end) between p_from and p_to
      and (p_source_id is null or source_id = p_source_id)
      and (p_campaign_id is null or campaign_id = p_campaign_id)
  ),
  ads_agg as (
    select
      coalesce(sum(spend), 0)::bigint as spend,
      coalesce(sum(leads), 0)::bigint as leads
    from ad_performance
    where brand_id = p_brand_id
      and date between p_from and p_to
      and level = 'campaign'
      and (p_campaign_id is null or entity_id = p_campaign_id)
  )
  select
    ads_agg.spend,
    ads_agg.leads as meta_leads,
    ads_agg.spend::numeric / nullif(ads_agg.leads, 0) as cpl_meta,
    lead_agg.total_lead, lead_agg.cold, lead_agg.consultation, lead_agg.offering, lead_agg.closing,
    lead_agg.reached_consultation, lead_agg.reached_offering, lead_agg.reached_closing,
    closing_agg.gross_booking_value, closing_agg.collected_revenue,
    closing_agg.cancelled_count::numeric / nullif(closing_agg.total_count, 0) as cancellation_rate,
    closing_agg.gross_profit,
    closing_agg.gross_profit::numeric / nullif(closing_agg.gross_booking_value, 0) as margin_pct,
    closing_agg.gross_profit - ads_agg.spend as net_contribution,
    (closing_agg.gross_profit - ads_agg.spend)::numeric / nullif(ads_agg.spend, 0) as roi,
    ads_agg.spend::numeric / nullif(closing_agg.closing_count, 0) as cpp,
    closing_agg.gross_profit::numeric / nullif(closing_agg.closing_count, 0) as breakeven_cpp,
    ads_agg.spend::numeric / nullif(closing_agg.gross_booking_value, 0) as ad_cost_ratio,
    closing_agg.cost_coverage_rate,
    closing_agg.median_interval as median_closing_interval_days,
    lead_agg.campaign_attribution_rate
  from lead_agg, closing_agg, ads_agg
$$;

-- Campaign Quality (F-08): one row per campaign for the period. Campaigns
-- with zero lead_reports rows still appear (left join) so a spend-only
-- campaign isn't silently dropped from the table.
create or replace function get_campaign_quality(
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
language sql
stable
as $$
  select
    c.id as campaign_id,
    c.name as campaign_name,
    o.spend, o.meta_leads, o.cpl_meta, o.total_lead,
    o.reached_consultation, o.reached_offering, o.closing,
    o.closing::numeric / nullif(o.total_lead, 0) as closing_rate,
    o.gross_profit, o.cpp, o.breakeven_cpp, o.roi
  from ad_campaigns c
  cross join lateral get_dashboard_overview(p_brand_id, p_from, p_to, p_attribution, null, c.id) o
  where c.brand_id = p_brand_id
  order by o.roi desc nulls last;
$$;

-- CS Performance (F-09/F-12): per-cs bucket, funnel, closing, profit,
-- interval stats, cancellation rate, report compliance (days reported this
-- period out of days elapsed). Sorted by gross_profit, not revenue — a cs
-- selling fewer, fatter-margin packages can out-contribute one selling more
-- cheap ones (02-PRD-v1.3.md §12).
create or replace function get_cs_performance(
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
language sql
stable
as $$
  select
    u.id as cs_id,
    u.full_name as cs_name,
    coalesce(lr.total_lead, 0) as total_lead,
    coalesce(lr.cold, 0) as cold,
    coalesce(lr.consultation, 0) as consultation,
    coalesce(lr.offering, 0) as offering,
    coalesce(lr.closing, 0) as closing,
    coalesce(ce.gross_booking_value, 0) as gross_booking_value,
    coalesce(ce.gross_profit, 0) as gross_profit,
    ce.avg_interval as avg_closing_interval,
    ce.median_interval as median_closing_interval,
    ce.cancellation_rate,
    coalesce(lr.report_days, 0) as report_days
  from app_users u
  left join (
    select
      cs_id,
      sum(total_lead) as total_lead, sum(cold) as cold, sum(consultation) as consultation,
      sum(offering) as offering, sum(closing) as closing,
      count(distinct report_date) as report_days
    from lead_reports
    where brand_id = p_brand_id and report_date between p_from and p_to
    group by cs_id
  ) lr on lr.cs_id = u.id
  left join (
    select
      cs_id,
      sum(revenue_gross) as gross_booking_value,
      sum(gross_profit) filter (where payment_status <> 'cancelled') as gross_profit,
      avg(interval_days) filter (where payment_status <> 'cancelled') as avg_interval,
      percentile_cont(0.5) within group (order by interval_days)
        filter (where payment_status <> 'cancelled') as median_interval,
      count(*) filter (where payment_status = 'cancelled')::numeric / nullif(count(*), 0) as cancellation_rate
    from v_closing_enriched
    where brand_id = p_brand_id and closing_date between p_from and p_to
    group by cs_id
  ) ce on ce.cs_id = u.id
  where u.brand_id = p_brand_id and u.role = 'cs'
  order by coalesce(ce.gross_profit, 0) desc;
$$;
