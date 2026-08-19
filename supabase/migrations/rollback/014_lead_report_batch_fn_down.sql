-- Rollback for 014_lead_report_batch_fn.sql. Not auto-applied by Supabase CLI.

drop function if exists create_lead_report_batch(uuid, uuid, date, jsonb, text);
