-- 012_trigger_audit_log.sql
-- CC-B12: T-5 write_audit_log, one function attached to six tables.
-- Ref: 04-BRIEF-BE.md §3 (T-5), 02-PRD-v1.3.md §17.
--
-- Not attached to audit_logs itself (would recurse). app_users only fires on
-- an actual role change (WHEN clause), matching "perubahan role user" — not
-- every profile edit.

create or replace function write_audit_log()
returns trigger
language plpgsql
as $$
declare
  v_brand_id uuid;
  v_record_id uuid;
begin
  if tg_op = 'DELETE' then
    v_brand_id := old.brand_id;
    v_record_id := old.id;
  else
    v_brand_id := new.brand_id;
    v_record_id := new.id;
  end if;

  insert into audit_logs (brand_id, user_id, action, table_name, record_id, old_value, new_value)
  values (
    v_brand_id,
    auth.uid(),
    tg_op,
    tg_table_name,
    v_record_id,
    case when tg_op <> 'INSERT' then to_jsonb(old) else null end,
    case when tg_op <> 'DELETE' then to_jsonb(new) else null end
  );

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

create trigger trg_audit_lead_reports
  after insert or update or delete on lead_reports
  for each row execute function write_audit_log();

create trigger trg_audit_lead_report_insights
  after insert or update or delete on lead_report_insights
  for each row execute function write_audit_log();

create trigger trg_audit_closings
  after insert or update or delete on closings
  for each row execute function write_audit_log();

create trigger trg_audit_program_prices
  after insert or update or delete on program_prices
  for each row execute function write_audit_log();

create trigger trg_audit_period_locks
  after insert or update or delete on period_locks
  for each row execute function write_audit_log();

create trigger trg_audit_app_users_role
  after update on app_users
  for each row
  when (old.role is distinct from new.role)
  execute function write_audit_log();
