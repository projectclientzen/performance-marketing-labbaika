-- Rollback for 005_ads.sql. Not auto-applied by Supabase CLI.

alter table closings drop constraint if exists closings_campaign_id_fkey;
alter table lead_reports drop constraint if exists lead_reports_campaign_id_fkey;

drop table if exists ad_performance;
drop table if exists ads;
drop table if exists ad_sets;
drop table if exists ad_campaigns;
drop table if exists ad_accounts;
