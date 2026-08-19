-- 008_trigger_cost_lock.sql
-- CC-B08b: T-7 lock_cost_at_closing
-- Ref: 04-BRIEF-BE.md §3 (T-7), 02-PRD-v1.3.md §9.3.
--
-- BEFORE INSERT only (never BEFORE UPDATE): cost_at_transaction is set once
-- and never re-derived, so editing program_costs later cannot change the
-- gross_profit of an existing closing. Runs server-side only — CS never
-- sends, sees, or edits this value (RLS + view split arrive in CC-B13).

create or replace function lock_cost_at_closing()
returns trigger
language plpgsql
as $$
declare
  v_cost bigint;
  v_margin numeric;
begin
  -- Prefer an exact departure match over a departure-agnostic (NULL) row.
  select cost_price into v_cost
  from program_costs
  where program_id = new.program_id
    and room_type = new.room_type
    and status = 'active'
    and effective_date <= new.closing_date
    and (end_date is null or end_date >= new.closing_date)
    and (departure_id = new.departure_id or departure_id is null)
  order by (departure_id is null) asc
  limit 1;

  if v_cost is not null then
    new.cost_at_transaction := v_cost;
    new.cost_source := 'actual';
    return new;
  end if;

  select default_margin_pct into v_margin
  from brand_settings
  where brand_id = new.brand_id;

  if v_margin is not null then
    new.cost_at_transaction := round(new.price_at_transaction * (1 - v_margin / 100))::bigint;
    new.cost_source := 'estimated';
    return new;
  end if;

  new.cost_at_transaction := null;
  new.cost_source := 'unknown';
  return new;
end;
$$;

create trigger trg_b3_lock_cost_at_closing
  before insert on closings
  for each row execute function lock_cost_at_closing();
