-- Rollback for 016_analytics_views.sql. Not auto-applied by Supabase CLI.

drop function if exists get_cs_performance(uuid, date, date);
drop function if exists get_campaign_quality(uuid, date, date, text);
drop function if exists get_dashboard_overview(uuid, date, date, text, uuid, uuid);
drop view if exists v_ads_daily;
drop view if exists v_closing_enriched;
drop view if exists v_lead_funnel_daily;
