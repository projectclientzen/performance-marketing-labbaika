-- Rollback for 020_fix_cs_closing_update.sql. Not auto-applied by Supabase CLI.

revoke update on v_closings_cs from authenticated;
