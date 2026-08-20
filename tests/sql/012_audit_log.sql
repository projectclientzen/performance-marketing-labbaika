-- Proof for CC-B12: insert/update/delete captured with old/new jsonb, and
-- app_users only audited on an actual role change.

begin;

insert into brands (name, slug) values ('Labbaika Group', 'labbaika-audit-test');

do $$
declare
  v_brand uuid; v_cs uuid; v_source uuid; v_report uuid;
  v_insert_count int; v_update_count int; v_delete_count int;
  v_old_cold int; v_new_cold int;
begin
  select id into v_brand from brands where slug = 'labbaika-audit-test';
  insert into auth.users (id) values (gen_random_uuid()) returning id into v_cs;
  insert into app_users (id, brand_id, full_name, role) values (v_cs, v_brand, 'Reza', 'cs');
  insert into lead_sources (brand_id, name, slug)
    values (v_brand, 'Facebook CTWA', 'facebook-ctwa') returning id into v_source;

  insert into lead_reports (brand_id, cs_id, report_date, source_id, total_lead, cold, consultation, offering)
  values (v_brand, v_cs, '2026-08-19', v_source, 50, 25, 15, 10)
  returning id into v_report;

  update lead_reports set cold = 24, consultation = 16 where id = v_report;

  delete from lead_reports where id = v_report;

  select count(*) into v_insert_count from audit_logs
    where table_name = 'lead_reports' and record_id = v_report and action = 'INSERT';
  select count(*) into v_update_count from audit_logs
    where table_name = 'lead_reports' and record_id = v_report and action = 'UPDATE';
  select count(*) into v_delete_count from audit_logs
    where table_name = 'lead_reports' and record_id = v_report and action = 'DELETE';

  if v_insert_count <> 1 or v_update_count <> 1 or v_delete_count <> 1 then
    raise exception 'TEST 1 FAILED: insert=%, update=%, delete=%', v_insert_count, v_update_count, v_delete_count;
  end if;

  select (old_value->>'cold')::int, (new_value->>'cold')::int
    into v_old_cold, v_new_cold
    from audit_logs where table_name = 'lead_reports' and record_id = v_report and action = 'UPDATE';

  if v_old_cold <> 25 or v_new_cold <> 24 then
    raise exception 'TEST 1 FAILED: old_value.cold=% new_value.cold=% (expected 25/24)', v_old_cold, v_new_cold;
  end if;
  raise notice 'TEST 1 PASSED: insert/update/delete each logged once, old/new jsonb correct (cold 25 -> 24)';

  -- Non-role update on app_users must NOT be audited.
  update app_users set full_name = 'Reza Updated' where id = v_cs;
  if exists (select 1 from audit_logs where table_name = 'app_users' and record_id = v_cs) then
    raise exception 'TEST 2 FAILED: non-role app_users update was audited';
  end if;
  raise notice 'TEST 2 PASSED: non-role app_users update not audited';

  -- Role change on app_users MUST be audited.
  update app_users set role = 'owner' where id = v_cs;
  if not exists (
    select 1 from audit_logs
    where table_name = 'app_users' and record_id = v_cs and action = 'UPDATE'
  ) then
    raise exception 'TEST 3 FAILED: role change was not audited';
  end if;
  raise notice 'TEST 3 PASSED: role change audited';
end $$;

rollback;
