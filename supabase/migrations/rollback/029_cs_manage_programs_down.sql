-- Rollback 029 — kembalikan program/keberangkatan/harga ke owner-only tulis.
begin;

drop policy if exists programs_brand_all on programs;
create policy programs_owner_all on programs for all
  using (brand_id = current_brand_id() and current_has_owner_access())
  with check (brand_id = current_brand_id() and current_has_owner_access());
create policy programs_cs_select on programs for select
  using (brand_id = current_brand_id());

drop policy if exists program_departures_brand_all on program_departures;
create policy program_departures_owner_all on program_departures for all
  using (brand_id = current_brand_id() and current_has_owner_access())
  with check (brand_id = current_brand_id() and current_has_owner_access());
create policy program_departures_cs_select on program_departures for select
  using (brand_id = current_brand_id());

drop policy if exists program_prices_brand_all on program_prices;
create policy program_prices_owner_all on program_prices for all
  using (brand_id = current_brand_id() and current_has_owner_access())
  with check (brand_id = current_brand_id() and current_has_owner_access());
create policy program_prices_cs_select on program_prices for select
  using (brand_id = current_brand_id());

commit;
