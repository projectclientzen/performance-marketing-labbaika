-- 017_fix_resolve_link_campaign.sql
-- Fix T-2 resolve_lead_report_link: matching on brand+cs+lead_date+source
-- only (per 04-BRIEF-BE.md §3's literal wording) is ambiguous whenever one
-- cs has two different campaigns feeding the same source on the same day —
-- lead_reports' own uniqueness already includes campaign_key (migration
-- 003) precisely because a block is keyed by (date, source, campaign), so
-- the link resolution should match the same key, not a subset of it.
--
-- Found via tests/sql/016_analytics.sql: two campaigns, same date/source,
-- closings for campaign B were linking to campaign A's lead_report (first
-- match won), corrupting that report's stage counts.

-- CREATE OR REPLACE does not preserve SECURITY DEFINER from the original
-- definition (migration 013) -- it resets to the default (INVOKER) unless
-- restated here. Must stay DEFINER: cs can insert into closings directly
-- (RLS policy closings_cs_insert) but has no SELECT policy on lead_reports
-- rows outside their own, and this lookup must not be limited by that.
create or replace function resolve_lead_report_link()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.lead_report_id is null then
    select id into new.lead_report_id
    from lead_reports
    where brand_id = new.brand_id
      and cs_id = new.cs_id
      and report_date = new.lead_date
      and source_id = new.source_id
      and campaign_id is not distinct from new.campaign_id
    limit 1;
  end if;
  return new;
end;
$$;
