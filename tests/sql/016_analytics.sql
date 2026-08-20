-- Proof for CC-B20 "selesai kalau": fixture matching 02-PRD-v1.3.md §11
-- (paket Rp32.900.000) reproduces closing rate A 2.0% / B 12.0%.
--
-- Angka profit di versi lama berkas ini (ROI 690%/2.269%, breakeven CPP
-- Rp3.948.000) diturunkan dari HPP, yang dibuang migrasi 023 -- lihat
-- 10-AUDIT-FE-BE.md #20. Metrik sekarang berbasis omset:
--
--   Campaign A: spend 5jt, 10 closing x 32,9jt = omset 329jt
--               breakeven_cpp = 329jt/10 = 32,9jt   roi = (329-5)/5 = 64,8
--   Campaign B: spend 5jt, 30 closing x 32,9jt = omset 987jt
--               breakeven_cpp = 987jt/30 = 32,9jt   roi = (987-5)/5 = 196,4
--
-- breakeven_cpp sama dengan harga paket di kedua campaign, dan itu memang
-- benar: tanpa HPP, titik impas biaya per closing persis sama dengan harga
-- jualnya.

begin;

insert into brands (name, slug) values ('Labbaika Group', 'labbaika-analytics-test');

do $$
declare
  v_brand uuid; v_cs uuid; v_owner uuid; v_source uuid; v_program uuid; v_departure uuid;
  v_account uuid; v_camp_a uuid; v_camp_b uuid;
  i int;
begin
  select id into v_brand from brands where slug = 'labbaika-analytics-test';
  insert into auth.users (id) values (gen_random_uuid()) returning id into v_cs;
  insert into app_users (id, brand_id, full_name, role) values (v_cs, v_brand, 'Reza', 'cs');
  -- Migrasi 023 menambahkan guard role=owner di get_dashboard_overview dan
  -- get_campaign_quality: angka omset dan spend se-brand bukan konsumsi cs
  -- (02-PRD-v1.3.md §4). Berkas ini karena itu memanggil sebagai owner.
  insert into auth.users (id) values (gen_random_uuid()) returning id into v_owner;
  insert into app_users (id, brand_id, full_name, role) values (v_owner, v_brand, 'Maszen', 'owner');

  insert into lead_sources (brand_id, name, slug) values (v_brand, 'Facebook CTWA', 'fb-ctwa') returning id into v_source;
  insert into programs (brand_id, name, destination, duration_days) values (v_brand, 'Umroh Turki 16D', 'Turki', 16) returning id into v_program;
  insert into program_departures (brand_id, program_id, departure_date) values (v_brand, v_program, '2026-10-12') returning id into v_departure;
  insert into ad_accounts (brand_id, external_id, name) values (v_brand, 'acc-1', 'Labbaika Ads') returning id into v_account;
  insert into ad_campaigns (brand_id, ad_account_id, external_id, name) values (v_brand, v_account, 'camp-a', 'Campaign A') returning id into v_camp_a;
  insert into ad_campaigns (brand_id, ad_account_id, external_id, name) values (v_brand, v_account, 'camp-b', 'Campaign B') returning id into v_camp_b;

  insert into ad_performance (brand_id, level, entity_id, date, spend, leads)
    values (v_brand, 'campaign', v_camp_a, '2026-08-15', 5000000, 500);
  insert into ad_performance (brand_id, level, entity_id, date, spend, leads)
    values (v_brand, 'campaign', v_camp_b, '2026-08-15', 5000000, 250);

  -- Campaign A: lead 500, reached_consultation 150, reached_offering 50, closing 10.
  insert into lead_reports (brand_id, cs_id, report_date, source_id, campaign_id, total_lead, cold, consultation, offering)
    values (v_brand, v_cs, '2026-08-15', v_source, v_camp_a, 500, 350, 100, 50);
  -- Campaign B: lead 250, reached_consultation 200, reached_offering 100, closing 30.
  insert into lead_reports (brand_id, cs_id, report_date, source_id, campaign_id, total_lead, cold, consultation, offering)
    values (v_brand, v_cs, '2026-08-15', v_source, v_camp_b, 250, 50, 100, 100);

  -- 10 closings for Campaign A, 30 for Campaign B, all at list price (no override).
  for i in 1..10 loop
    insert into closings (
      brand_id, cs_id, first_name, whatsapp_raw,
      lead_date, source_id, campaign_id, previous_stage,
      closing_date, program_id, departure_id, room_type, pax,
      price_at_transaction, total_value, payment_status
    ) values (
      v_brand, v_cs, 'Jamaah A' || i, '08123456' || lpad(i::text, 4, '0'),
      '2026-08-15', v_source, v_camp_a, 'offering',
      '2026-08-20', v_program, v_departure, 'quad', 1,
      32900000, 32900000, 'lunas'
    );
  end loop;

  for i in 1..30 loop
    insert into closings (
      brand_id, cs_id, first_name, whatsapp_raw,
      lead_date, source_id, campaign_id, previous_stage,
      closing_date, program_id, departure_id, room_type, pax,
      price_at_transaction, total_value, payment_status
    ) values (
      v_brand, v_cs, 'Jamaah B' || i, '08129876' || lpad(i::text, 4, '0'),
      '2026-08-15', v_source, v_camp_b, 'offering',
      '2026-08-20', v_program, v_departure, 'quad', 1,
      32900000, 32900000, 'lunas'
    );
  end loop;

  create temp table t016_ids as
    select v_brand as brand_id, v_cs as cs_id, v_owner as owner_id,
           v_camp_a as camp_a, v_camp_b as camp_b;
  grant select on t016_ids to authenticated;
end $$;

-- get_dashboard_overview/get_campaign_quality are SECURITY DEFINER, guarded on
-- p_brand_id (migration 019) and on role=owner (migration 023) -- must be
-- called as a real authenticated owner, not superuser (which has no auth.uid()
-- claim and would get "akses ditolak").
set local role authenticated;
select set_config('request.jwt.claim.sub', owner_id::text, false) from t016_ids;

do $$
declare
  v_brand uuid; v_camp_a uuid; v_camp_b uuid;
  v_overview record;
  v_quality record;
begin
  select brand_id, camp_a, camp_b into v_brand, v_camp_a, v_camp_b from t016_ids;

  -- Overview scoped to Campaign A (cohort attribution, lead_date-based).
  select * into v_overview from get_dashboard_overview(v_brand, '2026-08-01', '2026-08-31', 'cohort', null, v_camp_a);
  if v_overview.closing <> 10 or v_overview.gross_booking_value <> 329000000
     or v_overview.breakeven_cpp <> 32900000 then
    raise exception 'TEST FAILED (A): closing=%, omset=%, breakeven_cpp=%',
      v_overview.closing, v_overview.gross_booking_value, v_overview.breakeven_cpp;
  end if;
  if round(v_overview.roi, 2) <> 64.80 then
    raise exception 'TEST FAILED (A): roi=% expected 64.80 (6.480%%)', round(v_overview.roi, 2);
  end if;
  if round(v_overview.roas, 2) <> 65.80 then
    raise exception 'TEST FAILED (A): roas=% expected 65.80', round(v_overview.roas, 2);
  end if;
  raise notice 'TEST A PASSED: closing=10, omset=329jt, breakeven_cpp=32,9jt, roi=%, roas=%',
    round(v_overview.roi, 2), round(v_overview.roas, 2);

  select * into v_overview from get_dashboard_overview(v_brand, '2026-08-01', '2026-08-31', 'cohort', null, v_camp_b);
  if v_overview.closing <> 30 or v_overview.gross_booking_value <> 987000000
     or v_overview.breakeven_cpp <> 32900000 then
    raise exception 'TEST FAILED (B): closing=%, omset=%, breakeven_cpp=%',
      v_overview.closing, v_overview.gross_booking_value, v_overview.breakeven_cpp;
  end if;
  if round(v_overview.roi, 2) <> 196.40 then
    raise exception 'TEST FAILED (B): roi=% expected 196.40 (19.640%%)', round(v_overview.roi, 2);
  end if;
  raise notice 'TEST B PASSED: closing=30, omset=987jt, breakeven_cpp=32,9jt, roi=%, roas=%',
    round(v_overview.roi, 2), round(v_overview.roas, 2);

  -- Closing rate: 10/500 = 2.0%, 30/250 = 12.0%.
  select * into v_quality from get_campaign_quality(v_brand, '2026-08-01', '2026-08-31', 'cohort') where campaign_id = v_camp_a;
  if round(v_quality.closing_rate, 4) <> 0.02 then
    raise exception 'TEST FAILED: campaign A closing_rate=%, expected 0.02', v_quality.closing_rate;
  end if;
  select * into v_quality from get_campaign_quality(v_brand, '2026-08-01', '2026-08-31', 'cohort') where campaign_id = v_camp_b;
  if round(v_quality.closing_rate, 4) <> 0.12 then
    raise exception 'TEST FAILED: campaign B closing_rate=%, expected 0.12', v_quality.closing_rate;
  end if;
  raise notice 'TEST PASSED: closing_rate A=2.0%%, B=12.0%% (get_campaign_quality)';

  -- campaign_attribution_rate: both leads have campaign_id set -> 100%.
  select * into v_overview from get_dashboard_overview(v_brand, '2026-08-01', '2026-08-31', 'cohort', null, null);
  if v_overview.campaign_attribution_rate <> 1 then
    raise exception 'TEST FAILED: campaign_attribution_rate=%, expected 1.0', v_overview.campaign_attribution_rate;
  end if;
  raise notice 'TEST PASSED: campaign_attribution_rate = 100%% when every lead has campaign_id';
end $$;

reset role;
rollback;
