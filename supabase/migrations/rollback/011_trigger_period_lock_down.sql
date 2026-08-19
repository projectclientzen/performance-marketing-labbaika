-- Rollback for 011_trigger_period_lock.sql. Not auto-applied by Supabase CLI.

drop trigger if exists trg_block_locked_period_closings on closings;
drop trigger if exists trg_block_locked_period_insights on lead_report_insights;
drop trigger if exists trg_block_locked_period_lead_reports on lead_reports;
drop function if exists block_locked_period();

-- Restore apply_lead_report_stage_delta to its pre-011 body (from 009), without
-- the app.system_correction flag toggle.
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
end;
$$;
