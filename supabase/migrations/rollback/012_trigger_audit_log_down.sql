-- Rollback for 012_trigger_audit_log.sql. Not auto-applied by Supabase CLI.

drop trigger if exists trg_audit_app_users_role on app_users;
drop trigger if exists trg_audit_period_locks on period_locks;
drop trigger if exists trg_audit_program_prices on program_prices;
drop trigger if exists trg_audit_closings on closings;
drop trigger if exists trg_audit_lead_report_insights on lead_report_insights;
drop trigger if exists trg_audit_lead_reports on lead_reports;
drop function if exists write_audit_log();
