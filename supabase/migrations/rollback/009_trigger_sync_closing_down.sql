-- Rollback for 009_trigger_sync_closing.sql. Not auto-applied by Supabase CLI.

drop trigger if exists trg_sync_closing_to_lead_report on closings;
drop function if exists sync_closing_to_lead_report();
drop function if exists apply_lead_report_stage_delta(uuid, lead_stage, int, int);
