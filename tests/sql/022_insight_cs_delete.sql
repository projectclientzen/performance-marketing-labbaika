-- Proof for 10-AUDIT-FE-BE.md #5: cs can now re-save (replace-all) their own
-- lead_report_insights without a duplicate-key 500, and still cannot delete
-- another cs's insights via the same policy.

begin;

insert into brands (name, slug) values ('Labbaika Group', 'labbaika-022-test');

do $$
declare
  v_brand uuid; v_cs_a uuid; v_cs_b uuid; v_source uuid; v_cat uuid;
  v_report_a uuid; v_report_b uuid;
begin
  select id into v_brand from brands where slug = 'labbaika-022-test';
  insert into auth.users (id) values (gen_random_uuid()) returning id into v_cs_a;
  insert into auth.users (id) values (gen_random_uuid()) returning id into v_cs_b;

  insert into app_users (id, brand_id, full_name, role) values (v_cs_a, v_brand, 'CS A', 'cs');
  insert into app_users (id, brand_id, full_name, role) values (v_cs_b, v_brand, 'CS B', 'cs');

  insert into lead_sources (brand_id, name, slug) values (v_brand, 'FB', 'fb') returning id into v_source;
  insert into insight_categories (brand_id, name, slug) values (v_brand, 'Harga mahal', 'harga-mahal') returning id into v_cat;

  insert into lead_reports (brand_id, cs_id, report_date, source_id, total_lead, cold, consultation, offering, closing)
    values (v_brand, v_cs_a, '2026-08-19', v_source, 5, 2, 2, 1, 0) returning id into v_report_a;
  insert into lead_reports (brand_id, cs_id, report_date, source_id, total_lead, cold, consultation, offering, closing)
    values (v_brand, v_cs_b, '2026-08-19', v_source, 5, 2, 2, 1, 0) returning id into v_report_b;

  insert into lead_report_insights (brand_id, lead_report_id, stage, category_id, lead_count)
    values (v_brand, v_report_a, 'consultation', v_cat, 2);
  insert into lead_report_insights (brand_id, lead_report_id, stage, category_id, lead_count)
    values (v_brand, v_report_b, 'consultation', v_cat, 2);

  create temp table t022_ids as
    select v_brand as brand_id, v_cs_a as cs_a, v_cs_b as cs_b, v_report_a as report_a, v_report_b as report_b, v_cat as cat_id;
  grant select on t022_ids to authenticated;
end $$;

-- === CS A replaces (delete then insert) their own insight -- simulates the
-- route's second save, which used to 500 on the duplicate key before 022 ===
set role authenticated;
select set_config('request.jwt.claim.sub', cs_a::text, false) from t022_ids;

do $$
declare v_report uuid; v_cat uuid; v_del_count int;
begin
  select report_a, cat_id into v_report, v_cat from t022_ids;
  delete from lead_report_insights where lead_report_id = v_report and stage = 'consultation';
  get diagnostics v_del_count = row_count;
  if v_del_count <> 1 then
    raise exception 'TEST 1 FAILED: cs A delete matched % rows, expected 1', v_del_count;
  end if;
  insert into lead_report_insights (brand_id, lead_report_id, stage, category_id, lead_count)
    select brand_id, v_report, 'consultation', v_cat, 1 from t022_ids;
  raise notice 'TEST 1 PASSED: cs A replace-all (delete + re-insert) succeeded, no duplicate key error';
end $$;

-- === CS B cannot delete CS A's insight via the same policy ===
select set_config('request.jwt.claim.sub', cs_b::text, false) from t022_ids;

do $$
declare v_report uuid; v_count int;
begin
  select report_a into v_report from t022_ids;
  delete from lead_report_insights where lead_report_id = v_report and stage = 'consultation';
  get diagnostics v_count = row_count;
  if v_count <> 0 then
    raise exception 'TEST 2 FAILED: cs B deleted cs A''s insight, % rows matched', v_count;
  end if;
  raise notice 'TEST 2 PASSED: cs B cannot delete cs A''s insight (0 rows)';
end $$;

reset role;

-- Confirm cs A's replace actually persisted (lead_count=3, not the old 2).
do $$
declare v_count int;
begin
  select lead_count into v_count from lead_report_insights
    where lead_report_id = (select report_a from t022_ids) and stage = 'consultation';
  if v_count <> 1 then
    raise exception 'TEST 3 FAILED: lead_count=%, expected 1 (cs A''s replace should have stuck)', v_count;
  end if;
  raise notice 'TEST 3 PASSED: lead_count=1 -- cs A''s replace persisted, cs B''s delete attempt did not';
end $$;

rollback;
