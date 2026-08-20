-- Rollback for 022_fix_insight_cs_delete.sql. Not auto-applied by Supabase CLI.

revoke delete on lead_report_insights from authenticated;
drop policy if exists lead_report_insights_cs_delete on lead_report_insights;
