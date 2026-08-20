-- Proof for CC-B10 "selesai kalau": insight sum over stage count rejected on
-- both insert and on editing the report's stage count downward afterward.

begin;

insert into brands (name, slug) values ('Labbaika Group', 'labbaika-insight-test');
do $$
declare v_cs uuid;
begin
  insert into auth.users (id) values (gen_random_uuid()) returning id into v_cs;
  insert into app_users (id, brand_id, full_name, role)
    select v_cs, id, 'Reza', 'cs' from brands where slug = 'labbaika-insight-test';
end $$;
insert into lead_sources (brand_id, name, slug)
  select id, 'Facebook CTWA', 'facebook-ctwa' from brands where slug = 'labbaika-insight-test';
insert into insight_categories (brand_id, name, slug)
  select id, 'Harga', 'harga' from brands where slug = 'labbaika-insight-test';
insert into insight_categories (brand_id, name, slug)
  select id, 'Jadwal', 'jadwal' from brands where slug = 'labbaika-insight-test';

do $$
declare
  v_brand uuid; v_cs uuid; v_source uuid; v_report uuid; v_cat_harga uuid; v_cat_jadwal uuid;
begin
  select id into v_brand from brands where slug = 'labbaika-insight-test';
  select id into v_cs from app_users where brand_id = v_brand;
  select id into v_source from lead_sources where brand_id = v_brand;
  select id into v_cat_harga from insight_categories where brand_id = v_brand and slug = 'harga';
  select id into v_cat_jadwal from insight_categories where brand_id = v_brand and slug = 'jadwal';

  insert into lead_reports (brand_id, cs_id, report_date, source_id, total_lead, cold, consultation, offering)
  values (v_brand, v_cs, '2026-08-19', v_source, 20, 10, 3, 7)
  returning id into v_report;

  -- 7 lead di offering. Insert insight 5 harga: OK.
  insert into lead_report_insights (brand_id, lead_report_id, stage, category_id, lead_count)
  values (v_brand, v_report, 'offering', v_cat_harga, 5);

  -- Tambah 3 jadwal (5+3=8 > 7 offering): harus DITOLAK.
  begin
    insert into lead_report_insights (brand_id, lead_report_id, stage, category_id, lead_count)
    values (v_brand, v_report, 'offering', v_cat_jadwal, 3);
    raise exception 'TEST 1 FAILED: insight melebihi stage count diterima';
  exception
    when others then
      if sqlerrm like '%melebihi jumlah lead%' then
        raise notice 'TEST 1 PASSED: insight sum > stage count ditolak (%)', sqlerrm;
      else
        raise exception 'TEST 1 FAILED: wrong error: %', sqlerrm;
      end if;
  end;

  -- 2 jadwal (5+2=7=7): boleh, pas.
  insert into lead_report_insights (brand_id, lead_report_id, stage, category_id, lead_count)
  values (v_brand, v_report, 'offering', v_cat_jadwal, 2);
  raise notice 'TEST 2 PASSED: insight sum tepat = stage count diterima (5+2=7)';

  -- Sekarang edit laporan: offering turun dari 7 ke 5, insight sudah 7. Harus DITOLAK.
  begin
    update lead_reports set offering = 5, total_lead = 18 where id = v_report;
    raise exception 'TEST 3 FAILED: laporan diedit turun di bawah insight diterima';
  exception
    when others then
      if sqlerrm like '%tidak bisa diubah%' then
        raise notice 'TEST 3 PASSED: edit laporan turun di bawah insight ditolak (%)', sqlerrm;
      else
        raise exception 'TEST 3 FAILED: wrong error: %', sqlerrm;
      end if;
  end;
end $$;

rollback;
