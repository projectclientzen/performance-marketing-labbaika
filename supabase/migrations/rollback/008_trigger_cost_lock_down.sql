-- Rollback for 008_trigger_cost_lock.sql. Not auto-applied by Supabase CLI.

drop trigger if exists trg_b3_lock_cost_at_closing on closings;
drop function if exists lock_cost_at_closing();
