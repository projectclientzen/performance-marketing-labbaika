-- 029: revalidate_insight_totals should skip validation during system corrections
-- (T-1 apply_lead_report_stage_delta sets app.system_correction = on)
-- Without this, closing submissions fail when offering insights match the
-- original offering count but the trigger sees them as "exceeding" the
-- decremented value.

create or replace function revalidate_insight_totals()
returns trigger
language plpgsql
as $$
declare
  v_stage lead_stage;
  v_sum int;
  v_count int;
begin
  -- System corrections (T-1 closing stage delta) bypass validation
  if current_setting('app.system_correction', true) = 'on' then
    return new;
  end if;

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
