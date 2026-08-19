-- Rollback for 007_trigger_whatsapp_link.sql. Not auto-applied by Supabase CLI.

drop trigger if exists trg_b2_resolve_lead_report_link on closings;
drop trigger if exists trg_b1_normalize_whatsapp on closings;
drop function if exists resolve_lead_report_link();
drop function if exists normalize_whatsapp();
drop function if exists normalize_wa_id(text);
