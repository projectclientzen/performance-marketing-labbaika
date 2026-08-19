-- 011_trigger_period_lock.sql
-- CC-B11: T-4 block_locked_period + system_correction exception for T-1
-- Ref: 04-BRIEF-BE.md §3 (T-4), 02-PRD-v1.3.md §13.
--
-- Redefines apply_lead_report_stage_delta (from 009) to wrap its write with
-- the app.system_correction session flag, so T-1's automatic corrections to
-- a locked period are never blocked — only manual user writes are.

create or replace function block_locked_period()
returns trigger
language plpgsql
as $$
declare
  v_brand_id uuid;
  v_date date;
  v_year int;
  v_month int;
  v_locked boolean;
  v_uid uuid;
  v_is_owner boolean;
  v_record_id uuid;
begin
  if tg_op = 'DELETE' then
    v_brand_id := old.brand_id;
  else
    v_brand_id := new.brand_id;
  end if;

  if tg_table_name = 'lead_reports' then
    v_date := coalesce(new.report_date, old.report_date);
    v_record_id := coalesce(new.id, old.id);
  elsif tg_table_name = 'closings' then
    v_date := coalesce(new.closing_date, old.closing_date);
    v_record_id := coalesce(new.id, old.id);
  elsif tg_table_name = 'lead_report_insights' then
    select report_date into v_date
    from lead_reports
    where id = coalesce(new.lead_report_id, old.lead_report_id);
    v_record_id := coalesce(new.id, old.id);
  end if;

  v_year := extract(year from v_date);
  v_month := extract(month from v_date);

  select exists (
    select 1 from period_locks where brand_id = v_brand_id and year = v_year and month = v_month
  ) into v_locked;

  if not v_locked then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  -- System correction from T-1: never blocked, but logged.
  if current_setting('app.system_correction', true) = 'on' then
    insert into audit_logs (brand_id, user_id, action, table_name, record_id, new_value)
    values (
      v_brand_id, auth.uid(), 'cross_period_correction', tg_table_name, v_record_id,
      case when tg_op <> 'DELETE' then to_jsonb(new) else to_jsonb(old) end
    );
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  -- Owner bypass.
  v_uid := auth.uid();
  select (role = 'owner') into v_is_owner from app_users where id = v_uid;

  if coalesce(v_is_owner, false) then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  raise exception 'periode %-% sudah dikunci', v_year, lpad(v_month::text, 2, '0');
end;
$$;

create trigger trg_block_locked_period_lead_reports
  before insert or update or delete on lead_reports
  for each row execute function block_locked_period();

create trigger trg_block_locked_period_insights
  before insert or update or delete on lead_report_insights
  for each row execute function block_locked_period();

create trigger trg_block_locked_period_closings
  before insert or update or delete on closings
  for each row execute function block_locked_period();

-- Redefine T-1's write helper (from 009) to flag its own write as a system
-- correction, exempting it from the lock check above.
create or replace function apply_lead_report_stage_delta(
  p_lead_report_id uuid,
  p_stage lead_stage,
  p_delta_closing int,
  p_delta_stage int
) returns void
language plpgsql
as $$
declare
  v_current int;
  v_new int;
  v_report_date date;
begin
  if p_lead_report_id is null then
    return;
  end if;

  select report_date,
    case p_stage
      when 'cold' then cold
      when 'consultation' then consultation
      when 'offering' then offering
      else null
    end
  into v_report_date, v_current
  from lead_reports
  where id = p_lead_report_id
  for update;

  if v_report_date is null then
    raise exception 'lead_report % tidak ditemukan', p_lead_report_id;
  end if;

  v_new := v_current + p_delta_stage;
  if v_new < 0 then
    raise exception 'stage % pada laporan % tidak cukup untuk dikurangi', p_stage, to_char(v_report_date, 'DD Mon YYYY');
  end if;

  perform set_config('app.system_correction', 'on', true);

  if p_stage = 'cold' then
    update lead_reports set cold = v_new, closing = closing + p_delta_closing, updated_at = now()
    where id = p_lead_report_id;
  elsif p_stage = 'consultation' then
    update lead_reports set consultation = v_new, closing = closing + p_delta_closing, updated_at = now()
    where id = p_lead_report_id;
  elsif p_stage = 'offering' then
    update lead_reports set offering = v_new, closing = closing + p_delta_closing, updated_at = now()
    where id = p_lead_report_id;
  end if;

  perform set_config('app.system_correction', 'off', true);
end;
$$;
