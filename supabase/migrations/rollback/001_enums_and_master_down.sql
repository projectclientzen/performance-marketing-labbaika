-- Rollback for 001_enums_and_master.sql
-- Not auto-applied by Supabase CLI (lives outside supabase/migrations root).
-- Run manually against a scratch DB when testing the up-migration.

drop table if exists insight_categories;
drop table if exists lead_sources;
drop table if exists regions;
drop table if exists app_users;
drop table if exists brands;

drop type if exists region_level;
drop type if exists ad_level;
drop type if exists payment_status;
drop type if exists room_type;
drop type if exists lead_stage;
drop type if exists user_role;

-- Extensions intentionally left installed: later migrations depend on them
-- and dropping/recreating extensions on every rollback cycle is unnecessary risk.
