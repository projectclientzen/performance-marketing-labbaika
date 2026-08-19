-- Rollback for 010_trigger_insight_validation.sql. Not auto-applied by Supabase CLI.

drop trigger if exists trg_revalidate_insight_totals on lead_reports;
drop function if exists revalidate_insight_totals();
drop trigger if exists trg_validate_insight_total on lead_report_insights;
drop function if exists validate_insight_total();
