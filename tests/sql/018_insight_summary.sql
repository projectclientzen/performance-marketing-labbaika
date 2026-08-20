-- Proof for get_lead_insight_summary: percentage is of insight FILLED, not
-- total_lead, and both denominators are returned correctly.

begin;

insert into brands (name, slug) values ('Labbaika Group', 'labbaika-insight-sum-test');

do $$
declare
  v_brand uuid; v_cs uuid; v_source uuid; v_report uuid;
  v_cat_harga uuid; v_cat_jadwal uuid;
begin
  select id into v_brand from brands where slug = 'labbaika-insight-sum-test';
  insert into auth.users (id) values (gen_random_uuid()) returning id into v_cs;
  insert into app_users (id, brand_id, full_name, role) values (v_cs, v_brand, 'Reza', 'cs');
  insert into lead_sources (brand_id, name, slug) values (v_brand, 'Facebook CTWA', 'fb-ctwa') returning id into v_source;
  insert into insight_categories (brand_id, name, slug) values (v_brand, 'Harga', 'harga') returning id into v_cat_harga;
  insert into insight_categories (brand_id, name, slug) values (v_brand, 'Jadwal', 'jadwal') returning id into v_cat_jadwal;

  -- total_lead = 100, offering = 50. Insight filled: harga=25, jadwal=5 (total filled=30).
  insert into lead_reports (brand_id, cs_id, report_date, source_id, total_lead, cold, consultation, offering)
    values (v_brand, v_cs, '2026-08-19', v_source, 100, 30, 20, 50) returning id into v_report;

  insert into lead_report_insights (brand_id, lead_report_id, stage, category_id, lead_count)
    values (v_brand, v_report, 'offering', v_cat_harga, 25);
  insert into lead_report_insights (brand_id, lead_report_id, stage, category_id, lead_count)
    values (v_brand, v_report, 'offering', v_cat_jadwal, 5);

  create temp table t018_ids as select v_brand as brand_id, v_cs as cs_id;
  grant select on t018_ids to authenticated;
end $$;

-- get_lead_insight_summary is SECURITY DEFINER with a p_brand_id guard as
-- of migration 019 -- must call as a real authenticated role, not superuser.
set local role authenticated;
select set_config('request.jwt.claim.sub', cs_id::text, false) from t018_ids;

do $$
declare
  v_brand uuid;
  r record;
begin
  select brand_id into v_brand from t018_ids;

  select * into r from get_lead_insight_summary(v_brand, '2026-08-01', '2026-08-31') where category_name = 'Harga';

  -- pct_of_filled = 25/30 = 83.3%, pct_of_total_lead = 25/100 = 25%.
  if round(r.pct_of_filled, 4) <> round(25.0/30, 4) then
    raise exception 'TEST FAILED: pct_of_filled=%, expected %', r.pct_of_filled, 25.0/30;
  end if;
  if round(r.pct_of_total_lead, 4) <> 0.25 then
    raise exception 'TEST FAILED: pct_of_total_lead=%, expected 0.25', r.pct_of_total_lead;
  end if;
  raise notice 'TEST PASSED: Harga pct_of_filled=%.1f%% (25/30), pct_of_total_lead=25%% (25/100)', r.pct_of_filled*100;
end $$;

reset role;
rollback;
