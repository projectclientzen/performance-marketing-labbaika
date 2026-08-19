-- Rollback for 013_rls.sql. Not auto-applied by Supabase CLI.

revoke all on
  brands, app_users, lead_sources, insight_categories, programs,
  program_departures, program_prices, lead_reports, lead_report_insights,
  closings, program_costs, brand_settings, ad_accounts, ad_campaigns, ad_sets,
  ads, ad_performance, period_locks, export_logs, sync_logs, regions, audit_logs
  from authenticated;

alter function apply_lead_report_stage_delta(uuid, lead_stage, int, int) security invoker;
alter function sync_closing_to_lead_report() security invoker;
alter function revalidate_insight_totals() security invoker;
alter function validate_insight_total() security invoker;
alter function resolve_lead_report_link() security invoker;
alter function normalize_whatsapp() security invoker;
alter function lock_cost_at_closing() security invoker;
alter function block_locked_period() security invoker;
alter function write_audit_log() security invoker;

drop view if exists v_closings_cs;

drop policy if exists audit_logs_owner_select on audit_logs;
alter table audit_logs no force row level security;
alter table audit_logs disable row level security;

drop policy if exists sync_logs_owner_all on sync_logs;
alter table sync_logs no force row level security;
alter table sync_logs disable row level security;

drop policy if exists export_logs_owner_all on export_logs;
alter table export_logs no force row level security;
alter table export_logs disable row level security;

drop policy if exists period_locks_owner_all on period_locks;
alter table period_locks no force row level security;
alter table period_locks disable row level security;

drop policy if exists ad_performance_owner_all on ad_performance;
alter table ad_performance no force row level security;
alter table ad_performance disable row level security;

drop policy if exists ads_owner_all on ads;
alter table ads no force row level security;
alter table ads disable row level security;

drop policy if exists ad_sets_owner_all on ad_sets;
alter table ad_sets no force row level security;
alter table ad_sets disable row level security;

drop policy if exists ad_campaigns_owner_all on ad_campaigns;
alter table ad_campaigns no force row level security;
alter table ad_campaigns disable row level security;

drop policy if exists ad_accounts_owner_all on ad_accounts;
alter table ad_accounts no force row level security;
alter table ad_accounts disable row level security;

drop policy if exists closings_cs_update on closings;
drop policy if exists closings_cs_insert on closings;
drop policy if exists closings_owner_all on closings;
alter table closings no force row level security;
alter table closings disable row level security;

drop policy if exists lead_report_insights_cs_update on lead_report_insights;
drop policy if exists lead_report_insights_cs_insert on lead_report_insights;
drop policy if exists lead_report_insights_cs_own on lead_report_insights;
drop policy if exists lead_report_insights_owner_all on lead_report_insights;
alter table lead_report_insights no force row level security;
alter table lead_report_insights disable row level security;

drop policy if exists lead_reports_cs_update on lead_reports;
drop policy if exists lead_reports_cs_insert on lead_reports;
drop policy if exists lead_reports_cs_own on lead_reports;
drop policy if exists lead_reports_owner_all on lead_reports;
alter table lead_reports no force row level security;
alter table lead_reports disable row level security;

drop policy if exists brand_settings_owner_all on brand_settings;
alter table brand_settings no force row level security;
alter table brand_settings disable row level security;

drop policy if exists program_costs_owner_all on program_costs;
alter table program_costs no force row level security;
alter table program_costs disable row level security;

drop policy if exists program_prices_cs_select on program_prices;
drop policy if exists program_prices_owner_all on program_prices;
alter table program_prices no force row level security;
alter table program_prices disable row level security;

drop policy if exists program_departures_cs_select on program_departures;
drop policy if exists program_departures_owner_all on program_departures;
alter table program_departures no force row level security;
alter table program_departures disable row level security;

drop policy if exists programs_cs_select on programs;
drop policy if exists programs_owner_all on programs;
alter table programs no force row level security;
alter table programs disable row level security;

drop policy if exists insight_categories_cs_select on insight_categories;
drop policy if exists insight_categories_owner_all on insight_categories;
alter table insight_categories no force row level security;
alter table insight_categories disable row level security;

drop policy if exists lead_sources_cs_select on lead_sources;
drop policy if exists lead_sources_owner_all on lead_sources;
alter table lead_sources no force row level security;
alter table lead_sources disable row level security;

drop policy if exists regions_all_read on regions;
alter table regions no force row level security;
alter table regions disable row level security;

drop policy if exists app_users_cs_self on app_users;
drop policy if exists app_users_owner_all on app_users;
alter table app_users no force row level security;
alter table app_users disable row level security;

drop policy if exists brands_cs_select on brands;
drop policy if exists brands_owner_all on brands;
alter table brands no force row level security;
alter table brands disable row level security;

drop function if exists current_app_role();
drop function if exists current_brand_id();
