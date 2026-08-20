-- Proof for the second half of S0-02 (07-AUDIT-REPO.md): cs can update
-- their own closing through v_closings_cs (auto-updatable view), cannot
-- touch another cs's closing even via the view, and the view still never
-- exposes cost columns. First discovered as a real bug against the LIVE
-- project (not this local fixture): a plain UPDATE on the base `closings`
-- table matches 0 rows for cs regardless of RETURNING, because UPDATE
-- needs row-level SELECT visibility to find candidates at all, and cs has
-- none on the base table.

begin;

insert into brands (name, slug) values ('Labbaika Group', 'labbaika-020-test');

do $$
declare
  v_brand uuid; v_cs_a uuid; v_cs_b uuid; v_source uuid;
  v_program uuid; v_departure uuid; v_closing_id uuid;
begin
  select id into v_brand from brands where slug = 'labbaika-020-test';
  insert into auth.users (id) values (gen_random_uuid()) returning id into v_cs_a;
  insert into auth.users (id) values (gen_random_uuid()) returning id into v_cs_b;

  insert into app_users (id, brand_id, full_name, role) values (v_cs_a, v_brand, 'CS A', 'cs');
  insert into app_users (id, brand_id, full_name, role) values (v_cs_b, v_brand, 'CS B', 'cs');

  insert into lead_sources (brand_id, name, slug) values (v_brand, 'FB', 'fb') returning id into v_source;
  insert into programs (brand_id, name, destination, duration_days) values (v_brand, 'P', 'X', 9) returning id into v_program;
  insert into program_departures (brand_id, program_id, departure_date) values (v_brand, v_program, '2026-12-01') returning id into v_departure;

  insert into closings (
    brand_id, cs_id, first_name, whatsapp_raw, lead_date, source_id, previous_stage,
    closing_date, program_id, departure_id, room_type, pax, price_at_transaction, total_value, payment_status
  ) values (
    v_brand, v_cs_a, 'Budi', '081234500020', '2026-08-19', v_source, 'offering',
    '2026-08-20', v_program, v_departure, 'quad', 1, 32900000, 32900000, 'dp'
  ) returning id into v_closing_id;

  create temp table t020_ids as
    select v_brand as brand_id, v_cs_a as cs_a, v_cs_b as cs_b, v_closing_id as closing_id;
  grant select on t020_ids to authenticated;
end $$;

-- === CS A updates their own closing through the view ===
set role authenticated;
select set_config('request.jwt.claim.sub', cs_a::text, false) from t020_ids;

do $$
declare v_id uuid; v_count int;
begin
  select closing_id into v_id from t020_ids;
  update v_closings_cs set paid_amount = 5000000 where id = v_id;
  get diagnostics v_count = row_count;
  if v_count <> 1 then
    raise exception 'TEST 1 FAILED: cs A update via view matched % rows, expected 1', v_count;
  end if;
  raise notice 'TEST 1 PASSED: cs updates own closing via v_closings_cs (1 row)';
end $$;

-- === CS B cannot touch CS A's closing, even via the view ===
select set_config('request.jwt.claim.sub', cs_b::text, false) from t020_ids;

do $$
declare v_id uuid; v_count int;
begin
  select closing_id into v_id from t020_ids;
  update v_closings_cs set paid_amount = 999999999 where id = v_id;
  get diagnostics v_count = row_count;
  if v_count <> 0 then
    raise exception 'TEST 2 FAILED: cs B updated cs A''s closing via view, % rows matched', v_count;
  end if;
  raise notice 'TEST 2 PASSED: cs B cannot update cs A''s closing via v_closings_cs (0 rows)';
end $$;

reset role;

-- Confirm cs A's earlier update actually persisted and cs B's attempt did not.
do $$
declare v_paid bigint;
begin
  select paid_amount into v_paid from closings where id = (select closing_id from t020_ids);
  if v_paid <> 5000000 then
    raise exception 'TEST 3 FAILED: paid_amount=%, expected 5000000 (cs A''s update should have stuck)', v_paid;
  end if;
  raise notice 'TEST 3 PASSED: paid_amount=5000000 — cs A''s update persisted, cs B''s did not';
end $$;

-- v_closings_cs must still never expose cost columns.
do $$
declare v_has_cost boolean;
begin
  select exists (
    select 1 from information_schema.columns
    where table_name = 'v_closings_cs'
      and column_name in ('cost_at_transaction', 'cost_of_sales', 'gross_profit')
  ) into v_has_cost;
  if v_has_cost then
    raise exception 'TEST 4 FAILED: v_closings_cs exposes a cost column';
  end if;
  raise notice 'TEST 4 PASSED: v_closings_cs still has no cost/profit columns';
end $$;

rollback;
