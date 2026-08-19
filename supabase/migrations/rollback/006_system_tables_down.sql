-- Rollback for 006_system_tables.sql. Not auto-applied by Supabase CLI.

drop table if exists audit_logs;
drop table if exists sync_logs;
drop table if exists export_logs;
drop table if exists period_locks;
