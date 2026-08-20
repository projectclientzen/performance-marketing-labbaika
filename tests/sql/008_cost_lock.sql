-- Proof for CC-B08b "selesai kalau" — 4 scenarios.

begin;

insert into brands (name, slug) values ('Labbaika Group', 'labbaika-cost-test');
do $$
declare v_cs uuid;
begin
  insert into auth.users (id) values (gen_random_uuid()) returning id into v_cs;
  insert into app_users (id, brand_id, full_name, role)
    select v_cs, id, 'Reza', 'cs' from brands where slug = 'labbaika-cost-test';
end $$;
insert into lead_sources (brand_id, name, slug)
  select id, 'Facebook CTWA', 'facebook-ctwa' from brands where slug = 'labbaika-cost-test';
insert into programs (brand_id, name, destination, duration_days)
  select id, 'Umroh Turki 16D', 'Turki', 16 from brands where slug = 'labbaika-cost-test';
insert into program_departures (brand_id, program_id, departure_date)
  select b.id, p.id, '2026-10-12'
  from brands b join programs p on p.brand_id = b.id
  where b.slug = 'labbaika-cost-test';

do $$
declare
  v_brand uuid; v_cs uuid; v_source uuid; v_program uuid; v_departure uuid;
  v_cost bigint; v_source_col cost_source; v_profit bigint;
begin
  select id into v_brand from brands where slug = 'labbaika-cost-test';
  select id into v_cs from app_users where brand_id = v_brand;
  select id into v_source from lead_sources where brand_id = v_brand;
  select id into v_program from programs where brand_id = v_brand;
  select id into v_departure from program_departures where program_id = v_program;

  -- Scenario 1: HPP terisi -> cost_source = actual, gross_profit benar.
  insert into program_costs (brand_id, program_id, departure_id, room_type, cost_price, effective_date)
  values (v_brand, v_program, v_departure, 'quad', 28952000, '2026-08-01');

  insert into closings (
    brand_id, cs_id, first_name, whatsapp_raw,
    lead_date, source_id, previous_stage,
    closing_date, program_id, departure_id, room_type, pax,
    price_at_transaction, total_value, payment_status
  ) values (
    v_brand, v_cs, 'Budi Satu', '081111111111',
    '2026-08-19', v_source, 'offering',
    '2026-08-23', v_program, v_departure, 'quad', 1,
    32900000, 32900000, 'dp'
  ) returning cost_at_transaction, cost_source, gross_profit into v_cost, v_source_col, v_profit;

  if v_cost <> 28952000 or v_source_col <> 'actual' or v_profit <> 3948000 then
    raise exception 'TEST 1 FAILED: cost=% source=% profit=%', v_cost, v_source_col, v_profit;
  end if;
  raise notice 'TEST 1 PASSED: actual cost=%, source=%, gross_profit=%', v_cost, v_source_col, v_profit;

  -- Scenario 2: HPP kosong, default_margin_pct 12 -> estimated, cost = 88% harga jual.
  insert into brand_settings (brand_id, default_margin_pct) values (v_brand, 12);

  insert into closings (
    brand_id, cs_id, first_name, whatsapp_raw,
    lead_date, source_id, previous_stage,
    closing_date, program_id, departure_id, room_type, pax,
    price_at_transaction, total_value, payment_status
  ) values (
    v_brand, v_cs, 'Budi Dua', '081111111112',
    '2026-08-19', v_source, 'offering',
    '2026-08-23', v_program, v_departure, 'triple', 1, -- triple has no program_costs row
    34900000, 34900000, 'dp'
  ) returning cost_at_transaction, cost_source into v_cost, v_source_col;

  if v_cost <> round(34900000 * 0.88) or v_source_col <> 'estimated' then
    raise exception 'TEST 2 FAILED: cost=% (expected %) source=%', v_cost, round(34900000 * 0.88), v_source_col;
  end if;
  raise notice 'TEST 2 PASSED: estimated cost=% (88%% of price), source=%', v_cost, v_source_col;

  -- Scenario 3: keduanya kosong -> unknown, gross_profit = total_value.
  delete from brand_settings where brand_id = v_brand;

  insert into closings (
    brand_id, cs_id, first_name, whatsapp_raw,
    lead_date, source_id, previous_stage,
    closing_date, program_id, departure_id, room_type, pax,
    price_at_transaction, total_value, payment_status
  ) values (
    v_brand, v_cs, 'Budi Tiga', '081111111113',
    '2026-08-19', v_source, 'offering',
    '2026-08-23', v_program, v_departure, 'double', 1, -- double has no cost row, no default margin
    37500000, 37500000, 'dp'
  ) returning cost_at_transaction, cost_source, gross_profit into v_cost, v_source_col, v_profit;

  if v_cost is not null or v_source_col <> 'unknown' or v_profit <> 37500000 then
    raise exception 'TEST 3 FAILED: cost=% source=% profit=%', v_cost, v_source_col, v_profit;
  end if;
  raise notice 'TEST 3 PASSED: cost=NULL, source=unknown, gross_profit=total_value (%)', v_profit;

  -- Scenario 4: ubah HPP master setelah closing tersimpan -> transaksi lama tidak berubah.
  update program_costs set cost_price = 99999999 where room_type = 'quad';

  select gross_profit into v_profit from closings where whatsapp_raw = '081111111111';
  if v_profit <> 3948000 then
    raise exception 'TEST 4 FAILED: old closing gross_profit changed to %', v_profit;
  end if;
  raise notice 'TEST 4 PASSED: master HPP change did not affect old closing, gross_profit still %', v_profit;
end $$;

rollback;
