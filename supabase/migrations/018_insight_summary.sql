-- 018_insight_summary.sql
-- Support for F-10 Lead Intelligence (Top Reason Not Closing).
-- Ref: 02-PRD-v1.3.md §6 — percentage is of total insight FILLED, not
-- total lead; both denominators are returned so the UI can show both
-- ("Harga 32% dari 412 lead diberi insight, 66% dari total lead").

create or replace function get_lead_insight_summary(
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
language sql
stable
as $$
  with filled as (
    select
      i.category_id,
      c.name as category_name,
      sum(i.lead_count) as lead_count
    from lead_report_insights i
    join insight_categories c on c.id = i.category_id
    join lead_reports r on r.id = i.lead_report_id
    where r.brand_id = p_brand_id
      and r.report_date between p_from and p_to
    group by i.category_id, c.name
  ),
  totals as (
    select
      coalesce(sum(lead_count), 0) as total_filled,
      (select coalesce(sum(total_lead), 0) from lead_reports
        where brand_id = p_brand_id and report_date between p_from and p_to) as total_lead
    from filled
  )
  select
    filled.category_id,
    filled.category_name,
    filled.lead_count,
    filled.lead_count::numeric / nullif(totals.total_filled, 0) as pct_of_filled,
    filled.lead_count::numeric / nullif(totals.total_lead, 0) as pct_of_total_lead
  from filled, totals
  order by filled.lead_count desc;
$$;
