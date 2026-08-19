-- Rollback for 018_insight_summary.sql. Not auto-applied by Supabase CLI.

drop function if exists get_lead_insight_summary(uuid, date, date);
