-- Rollback for 021_fix_export_access.sql. Not auto-applied by Supabase CLI.
-- Drops the guarded export functions. Does NOT restore direct view access
-- (that was 019's grant, already revoked and correctly so) -- after this
-- rollback the export routes go back to broken until they're reverted too.

drop function if exists get_export_operational(uuid,date,date,uuid,uuid,uuid,payment_status,int,int);
drop function if exists get_export_meta_ltv(uuid,date,date,int,int);
