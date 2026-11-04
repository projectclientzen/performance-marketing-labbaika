-- DESTRUCTIVE: disposable test DB only, or explicit migration rollback after export/backup.
-- Prefer operational rollback: set mode off and stop worker; retain accepted-event history.
begin;
drop function if exists resolve_capi_event(uuid,text,text);
drop function if exists capi_coverage(uuid);
drop table if exists capi_worker_runs;
drop trigger if exists capi_settings_after_write on capi_settings;
drop function if exists capi_settings_audit();
drop trigger if exists capi_closing_after_write on closings;
drop trigger if exists capi_payment_before_write on closings;
drop trigger if exists capi_settings_before_write on capi_settings;
drop function if exists claim_capi_events(uuid,int,int);
drop function if exists complete_capi_event(uuid,uuid,text,text);
drop function if exists capi_queue_closing();
drop function if exists capi_validate_payment_time();
drop function if exists capi_settings_guard();
drop table capi_events;
drop table capi_settings;
-- Keep nullable first_payment_received_at and its CS view column to preserve collected evidence.
commit;
