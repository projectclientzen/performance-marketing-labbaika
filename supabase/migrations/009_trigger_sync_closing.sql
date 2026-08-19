-- 009_trigger_sync_closing.sql
-- CC-B09: T-1 sync_closing_to_lead_report — most critical trigger in the system.
-- Ref: 04-BRIEF-BE.md §3 (T-1), 02-PRD-v1.3.md §3.3.
--
-- A closing "occupies" a stage slot in a lead_report iff lead_report_id is
-- not null AND payment_status <> 'cancelled'. AFTER trigger (side effect on
-- a different table), fires after T-2 (BEFORE INSERT) has already resolved
-- lead_report_id, so NEW.lead_report_id is final by the time this runs.
--
-- UPDATE always reverses the OLD effect (if any) then applies the NEW effect
-- (if any) — this single rule correctly covers cancel/uncancel, previous_stage
-- changes, and lead_report_id moves without special-casing each combination.
-- Reversal only ever adds back what this row itself contributed, so it can
-- never underflow; applying a new effect can, and is checked explicitly.

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

create or replace function sync_closing_to_lead_report()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.lead_report_id is not null and new.payment_status <> 'cancelled' then
      perform apply_lead_report_stage_delta(new.lead_report_id, new.previous_stage, 1, -1);
    end if;
    return new;

  elsif tg_op = 'DELETE' then
    if old.lead_report_id is not null and old.payment_status <> 'cancelled' then
      perform apply_lead_report_stage_delta(old.lead_report_id, old.previous_stage, -1, 1);
    end if;
    return old;

  elsif tg_op = 'UPDATE' then
    if old.lead_report_id is not null and old.payment_status <> 'cancelled' then
      perform apply_lead_report_stage_delta(old.lead_report_id, old.previous_stage, -1, 1);
    end if;
    if new.lead_report_id is not null and new.payment_status <> 'cancelled' then
      perform apply_lead_report_stage_delta(new.lead_report_id, new.previous_stage, 1, -1);
    end if;
    return new;
  end if;

  return null;
end;
$$;

create trigger trg_sync_closing_to_lead_report
  after insert or update or delete on closings
  for each row execute function sync_closing_to_lead_report();
