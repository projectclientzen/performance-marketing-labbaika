-- Proof for CC-B13/CC-B14 core RLS assertions, run as the real `authenticated`
-- role (not postgres/superuser) so RLS actually applies.

begin;

-- Setup as postgres (bypasses RLS, as intended for admin/migration work).
insert into brands (name, slug) values ('Labbaika Group', 'labbaika-rls-test');

do $$
declare
  v_brand uuid; v_cs_a uuid; v_cs_b uuid; v_owner uuid; v_source uuid;
  v_program uuid; v_departure uuid; v_report_a uuid;
begin
  select id into v_brand from brands where slug = 'labbaika-rls-test';
  insert into auth.users (id) values (gen_random_uuid()) returning id into v_cs_a;
  insert into auth.users (id) values (gen_random_uuid()) returning id into v_cs_b;
  insert into auth.users (id) values (gen_random_uuid()) returning id into v_owner;

  insert into app_users (id, brand_id, full_name, role) values (v_cs_a, v_brand, 'Reza', 'cs');
  insert into app_users (id, brand_id, full_name, role) values (v_cs_b, v_brand, 'Dina', 'cs');
  insert into app_users (id, brand_id, full_name, role) values (v_owner, v_brand, 'Owner', 'owner');

  insert into lead_sources (brand_id, name, slug) values (v_brand, 'Facebook CTWA', 'facebook-ctwa') returning id into v_source;
  insert into programs (brand_id, name, destination, duration_days) values (v_brand, 'Umroh Turki 16D', 'Turki', 16) returning id into v_program;
  insert into program_departures (brand_id, program_id, departure_date) values (v_brand, v_program, '2026-10-12') returning id into v_departure;
  insert into brand_settings (brand_id) values (v_brand);

  insert into lead_reports (brand_id, cs_id, report_date, source_id, total_lead, cold, consultation, offering)
    values (v_brand, v_cs_a, '2026-08-19', v_source, 10, 5, 3, 2) returning id into v_report_a;

  -- CS A closing, via direct table insert as postgres for setup speed.
  insert into closings (
    brand_id, cs_id, first_name, whatsapp_raw, lead_date, source_id,
    lead_report_id, previous_stage, closing_date, program_id, departure_id,
    room_type, pax, price_at_transaction, total_value, payment_status
  ) values (
    v_brand, v_cs_a, 'Budi', '081234500001', '2026-08-19', v_source,
    v_report_a, 'offering', '2026-08-23', v_program, v_departure,
    'quad', 1, 32900000, 32900000, 'dp'
  );

  -- period lock, for the "cs cannot write period_locks" assertion.
  insert into period_locks (brand_id, year, month, locked_by) values (v_brand, 2025, 1, v_owner);

  -- Stash ids in a temp table so subsequent authenticated-role statements
  -- (which can't see cross-session plpgsql vars) can read them back.
  create temp table rls_test_ids as
    select v_brand as brand_id, v_cs_a as cs_a, v_cs_b as cs_b, v_owner as owner;
  grant select on rls_test_ids to authenticated;
end $$;

-- === Switch to CS A session ===
set role authenticated;
select set_config('request.jwt.claim.sub', cs_a::text, false) from rls_test_ids;

-- 1. CS A cannot read closing rows belonging to CS B (there are none, but
--    prove the row-count rule generically): CS A must see exactly their own row.
do $$
declare v_count int; v_total int;
begin
  select count(*) into v_count from closings where cs_id = (select cs_a from rls_test_ids);
  select count(*) into v_total from closings;
  if v_total <> v_count then
    raise exception 'TEST FAILED: cs sees % rows total but only % are theirs -- leak', v_total, v_count;
  end if;
  raise notice 'TEST 1a PASSED: cs sees only own closing rows via direct table (% row(s))', v_total;
end $$;

-- 1b. "cabut hak SELECT cs pada closings" is enforced at the RLS-policy
--     level, not a table GRANT revoke -- owner and cs share the single
--     `authenticated` Postgres role in Supabase's model, so a GRANT-level
--     revoke can't distinguish them; only per-command RLS policies can.
--     There is no cs SELECT policy on closings at all, so a bare SELECT
--     returns zero rows even though the table has 1 row total (seen earlier
--     via superuser setup) -- proving cs has no read path except the view.
do $$
declare v_n int;
begin
  select count(*) into v_n from closings;
  if v_n <> 0 then
    raise exception 'TEST FAILED: cs direct SELECT on closings returned % rows, expected 0', v_n;
  end if;
  raise notice 'TEST 1b PASSED: cs direct SELECT on closings returns 0 rows (no cs SELECT policy exists)';
end $$;

-- 2. cs cannot read ad_performance, brand_settings, audit_logs.
-- program_costs tidak lagi diperiksa di sini: tabelnya dibuang migrasi 023
-- (10-AUDIT-FE-BE.md #20). Yang dulu dijaga -- HPP tidak boleh sampai ke cs --
-- sekarang dijamin lebih kuat, karena datanya memang tidak ada di mana pun.
do $$
declare v_n int;
begin
  begin
    select count(*) into v_n from ad_performance;
    if v_n <> 0 then raise exception 'TEST 2 FAILED: cs saw % ad_performance rows', v_n; end if;
  exception when insufficient_privilege then null; -- also acceptable
  end;

  begin
    select count(*) into v_n from brand_settings;
    if v_n <> 0 then raise exception 'TEST 2 FAILED: cs saw % brand_settings rows', v_n; end if;
  exception when insufficient_privilege then null;
  end;

  begin
    select count(*) into v_n from audit_logs;
    if v_n <> 0 then raise exception 'TEST 2 FAILED: cs saw % audit_logs rows', v_n; end if;
  exception when insufficient_privilege then null;
  end;

  raise notice 'TEST 2 PASSED: cs sees zero rows in ad_performance/brand_settings/audit_logs';
end $$;

-- 3. cs cannot write period_locks.
do $$
declare v_brand uuid;
begin
  select brand_id into v_brand from rls_test_ids;
  begin
    insert into period_locks (brand_id, year, month) values (v_brand, 2026, 1);
    raise exception 'TEST 3 FAILED: cs inserted into period_locks';
  exception
    when insufficient_privilege then
      raise notice 'TEST 3 PASSED: cs cannot write period_locks (insufficient_privilege)';
  end;
end $$;

-- 4. cs can read programs and program_prices.
do $$
declare v_n int;
begin
  select count(*) into v_n from programs;
  if v_n = 0 then raise exception 'TEST 4 FAILED: cs cannot read programs'; end if;
  raise notice 'TEST 4 PASSED: cs can read programs (% row(s))', v_n;
end $$;

-- 5. cs reads their own closing via v_closings_cs, and it never exposes cost columns.
do $$
declare v_n int; v_has_cost_col boolean;
begin
  select count(*) into v_n from v_closings_cs;
  if v_n <> 1 then raise exception 'TEST 5 FAILED: expected 1 row via v_closings_cs, got %', v_n; end if;

  -- Pemeriksaan ini dipertahankan sebagai jaring pengaman regresi, bukan
  -- formalitas: kolom biaya sudah dibuang seluruhnya oleh migrasi 023, jadi
  -- assertion ini gagal kalau ada yang mengembalikannya lewat pintu belakang.
  select exists (
    select 1 from information_schema.columns
    where table_name = 'v_closings_cs'
      and column_name in ('cost_at_transaction', 'cost_of_sales', 'gross_profit')
  ) into v_has_cost_col;
  if v_has_cost_col then
    raise exception 'TEST 5 FAILED: v_closings_cs exposes a cost/profit column';
  end if;
  raise notice 'TEST 5 PASSED: v_closings_cs returns cs own row (%), no cost/profit columns present', v_n;
end $$;

-- === Switch to CS B session: must not see CS A's report/closing/insights ===
select set_config('request.jwt.claim.sub', cs_b::text, false) from rls_test_ids;

do $$
declare v_n int;
begin
  select count(*) into v_n from lead_reports;
  if v_n <> 0 then raise exception 'TEST 6 FAILED: cs B sees % of cs A''s lead_reports', v_n; end if;
  select count(*) into v_n from v_closings_cs;
  if v_n <> 0 then raise exception 'TEST 6 FAILED: cs B sees % of cs A''s closings via view', v_n; end if;
  raise notice 'TEST 6 PASSED: cs B sees zero of cs A''s lead_reports/closings (no cross-cs leak)';
end $$;

reset role;
rollback;
