-- 026_restore_analytics_impl.sql
-- Migrasi 023 hanya terpasang separuh di project live. Ketahuan saat dev server
-- dijalankan dan dashboard Owner membalas 500:
--
--   function _get_dashboard_overview_impl(uuid, date, date, text, uuid, uuid)
--   does not exist
--
-- Dipastikan lewat probe RPC satu per satu (PGRST202 = tidak ada, 42501 = ada
-- tapi tanpa grant):
--
--   _get_dashboard_overview_impl    TIDAK ADA
--   _get_campaign_quality_impl      TIDAK ADA
--   _get_cs_performance_impl        TIDAK ADA
--   _get_lead_insight_summary_impl  ada  (milik 018/019, memang tidak di-drop 023)
--   v_closing_enriched              TIDAK ADA
--   keempat wrapper publik          ada
--
-- Jadi 023 berhenti sesudah langkah 2. Langkah 1 sempat membuang view dan tiga
-- impl lama, kolom biaya sempat terbuang, lalu langkah 3 dan 4 yang membangun
-- ulang tidak pernah jalan. Migrasi 024 sesudahnya memakai
-- `create or replace function` untuk wrapper, sehingga wrappernya tetap terbuat
-- dan memanggil impl yang tidak ada — itulah 500-nya.
--
-- Akibatnya di produksi: Dashboard Overview, Campaign Quality, dan CS
-- Performance mati total. Export tidak terpengaruh (021 berdiri sendiri, tidak
-- lewat impl ini).
--
-- Isi berkas ini disalin apa adanya dari langkah 3 dan 4 milik 023, hanya
-- diubah jadi `create or replace` supaya aman dijalankan berapa kali pun dan
-- tidak peduli sejauh mana 023 sempat berjalan.
--
-- Pelajarannya: menjalankan migrasi lewat SQL Editor tanpa `ON_ERROR_STOP` dan
-- tanpa transaksi membuat kegagalan di tengah tidak terlihat sama sekali —
-- sebagian statement commit, sisanya diam-diam terlewat.

create or replace view v_closing_enriched as
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

revoke all on v_closing_enriched from anon, authenticated;

create or replace function _get_dashboard_overview_impl(
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
  net_revenue bigint,
  roi numeric,
  roas numeric,
  cpp numeric,
  breakeven_cpp numeric,
  ad_cost_ratio numeric,
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
      count(*) filter (where payment_status <> 'cancelled') as closing_count,
      count(*) filter (where payment_status = 'cancelled') as cancelled_count,
      count(*) as total_count,
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
    closing_agg.gross_booking_value,
    closing_agg.collected_revenue,
    closing_agg.cancelled_count::numeric / nullif(closing_agg.total_count, 0) as cancellation_rate,
    closing_agg.gross_booking_value - ads_agg.spend as net_revenue,
    (closing_agg.gross_booking_value - ads_agg.spend)::numeric / nullif(ads_agg.spend, 0) as roi,
    closing_agg.gross_booking_value::numeric / nullif(ads_agg.spend, 0) as roas,
    ads_agg.spend::numeric / nullif(closing_agg.closing_count, 0) as cpp,
    closing_agg.gross_booking_value::numeric / nullif(closing_agg.closing_count, 0) as breakeven_cpp,
    ads_agg.spend::numeric / nullif(closing_agg.gross_booking_value, 0) as ad_cost_ratio,
    closing_agg.median_interval as median_closing_interval_days,
    lead_agg.campaign_attribution_rate
  from lead_agg, closing_agg, ads_agg
$$;

create or replace function _get_campaign_quality_impl(
  p_brand_id uuid, p_from date, p_to date, p_attribution text default 'cohort'
) returns table (
  campaign_id uuid, campaign_name text, spend bigint, meta_leads bigint, cpl_meta numeric,
  total_lead bigint, reached_consultation bigint, reached_offering bigint, closing bigint,
  closing_rate numeric, gross_booking_value bigint, cpp numeric, breakeven_cpp numeric,
  roi numeric, roas numeric
)
language sql
stable
as $$
  select
    c.id as campaign_id, c.name as campaign_name,
    o.spend, o.meta_leads, o.cpl_meta, o.total_lead,
    o.reached_consultation, o.reached_offering, o.closing,
    o.closing::numeric / nullif(o.total_lead, 0) as closing_rate,
    o.gross_booking_value, o.cpp, o.breakeven_cpp, o.roi, o.roas
  from ad_campaigns c
  cross join lateral _get_dashboard_overview_impl(p_brand_id, p_from, p_to, p_attribution, null, c.id) o
  where c.brand_id = p_brand_id
  order by o.roi desc nulls last;
$$;

create or replace function _get_cs_performance_impl(
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
      avg(interval_days) filter (where payment_status <> 'cancelled') as avg_interval,
      percentile_cont(0.5) within group (order by interval_days)
        filter (where payment_status <> 'cancelled') as median_interval,
      count(*) filter (where payment_status = 'cancelled')::numeric / nullif(count(*), 0) as cancellation_rate
    from v_closing_enriched
    where brand_id = p_brand_id and closing_date between p_from and p_to
    group by cs_id
  ) ce on ce.cs_id = u.id
  where u.brand_id = p_brand_id and u.role = 'cs'
  order by coalesce(ce.gross_booking_value, 0) desc;
$$;

revoke execute on function _get_dashboard_overview_impl(uuid,date,date,text,uuid,uuid) from public, anon, authenticated;
revoke execute on function _get_campaign_quality_impl(uuid,date,date,text) from public, anon, authenticated;
revoke execute on function _get_cs_performance_impl(uuid,date,date) from public, anon, authenticated;

do $$
declare v_hilang text;
begin
  select string_agg(n, ', ') into v_hilang from unnest(array[
    '_get_dashboard_overview_impl','_get_campaign_quality_impl',
    '_get_cs_performance_impl','_get_lead_insight_summary_impl',
    'get_dashboard_overview','get_campaign_quality','get_cs_performance','get_lead_insight_summary'
  ]) n where to_regprocedure('public.' || n || '(uuid,date,date)') is null
        and not exists (select 1 from pg_proc where proname = n);
  if v_hilang is not null then
    raise exception 'fungsi analitik masih hilang: %', v_hilang;
  end if;
  if to_regclass('public.v_closing_enriched') is null then
    raise exception 'view v_closing_enriched masih hilang';
  end if;
  raise notice '026 OK: view dan seluruh fungsi analitik lengkap';
end $$;
