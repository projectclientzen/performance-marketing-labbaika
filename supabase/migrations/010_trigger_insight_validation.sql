-- 010_trigger_insight_validation.sql
-- CC-B10: T-3 validate_insight_total
-- Ref: 04-BRIEF-BE.md §3 (T-3), 02-PRD-v1.3.md §6.
--
-- Two triggers: one blocks an insight write that would exceed its stage's
-- lead count, the other blocks editing a lead_report's stage counts down
-- below insight already recorded against it.
--
-- Known limitation, not handled here: trigger T-1 (CC-B09) also UPDATEs
-- lead_reports when a closing moves a lead out of a stage, and that write
-- goes through this same revalidation. If insight sum for a stage is already
-- near its count, a legitimate closing could be blocked by stale insight
-- data. Out of scope for CC-B10; flag if it surfaces in practice.

create or replace function validate_insight_total()
returns trigger
language plpgsql
as $$
declare
  v_stage_count int;
  v_current_sum int;
begin
  select case new.stage
    when 'cold' then cold
    when 'consultation' then consultation
    when 'offering' then offering
    when 'closing' then closing
  end into v_stage_count
  from lead_reports
  where id = new.lead_report_id;

  if v_stage_count is null then
    raise exception 'lead_report % tidak ditemukan', new.lead_report_id;
  end if;

  select coalesce(sum(lead_count), 0) into v_current_sum
  from lead_report_insights
  where lead_report_id = new.lead_report_id
    and stage = new.stage
    and id <> new.id;

  if v_current_sum + new.lead_count > v_stage_count then
    raise exception 'total insight stage % (%) melebihi jumlah lead di stage tersebut (%)',
      new.stage, v_current_sum + new.lead_count, v_stage_count;
  end if;

  return new;
end;
$$;

create trigger trg_validate_insight_total
  before insert or update on lead_report_insights
  for each row execute function validate_insight_total();

create or replace function revalidate_insight_totals()
returns trigger
language plpgsql
as $$
declare
  v_stage lead_stage;
  v_sum int;
  v_count int;
begin
  foreach v_stage in array array['cold', 'consultation', 'offering', 'closing']::lead_stage[] loop
    select coalesce(sum(lead_count), 0) into v_sum
    from lead_report_insights
    where lead_report_id = new.id and stage = v_stage;

    v_count := case v_stage
      when 'cold' then new.cold
      when 'consultation' then new.consultation
      when 'offering' then new.offering
      when 'closing' then new.closing
    end;

    if v_sum > v_count then
      raise exception 'laporan tidak bisa diubah: total insight stage % (%) melebihi jumlah lead baru (%)',
        v_stage, v_sum, v_count;
    end if;
  end loop;

  return new;
end;
$$;

create trigger trg_revalidate_insight_totals
  before update on lead_reports
  for each row execute function revalidate_insight_totals();
