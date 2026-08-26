-- 029 — CS boleh mengelola program, keberangkatan, dan harga.
--
-- Keputusan owner: CS ikut menambah/mengurangi program untuk upsell dan
-- cross-sell, bukan sekadar memilih saat closing. Sebelumnya ketiga tabel ini
-- owner-only untuk tulis (policy _owner_all + current_has_owner_access), CS
-- hanya SELECT. Sekarang kendalinya cukup batas brand: siapa pun app user di
-- brand yang sama boleh mengelola. RLS tetap force, jadi anon dan lintas-brand
-- tetap tertutup. program_costs / brand_settings TIDAK tersentuh migrasi ini.
--
-- Idempoten: drop-if-exists lalu create, dibungkus transaksi, dengan blok
-- verifikasi yang menggagalkan migrasi kalau salah satu policy tak terbentuk.

begin;

-- programs
drop policy if exists programs_owner_all on programs;
drop policy if exists programs_cs_select on programs;
create policy programs_brand_all on programs for all
  using (brand_id = current_brand_id())
  with check (brand_id = current_brand_id());

-- program_departures
drop policy if exists program_departures_owner_all on program_departures;
drop policy if exists program_departures_cs_select on program_departures;
create policy program_departures_brand_all on program_departures for all
  using (brand_id = current_brand_id())
  with check (brand_id = current_brand_id());

-- program_prices
drop policy if exists program_prices_owner_all on program_prices;
drop policy if exists program_prices_cs_select on program_prices;
create policy program_prices_brand_all on program_prices for all
  using (brand_id = current_brand_id())
  with check (brand_id = current_brand_id());

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'programs' and policyname = 'programs_brand_all') then
    raise exception '029: programs_brand_all tidak terbentuk';
  end if;
  if not exists (select 1 from pg_policies where tablename = 'program_departures' and policyname = 'program_departures_brand_all') then
    raise exception '029: program_departures_brand_all tidak terbentuk';
  end if;
  if not exists (select 1 from pg_policies where tablename = 'program_prices' and policyname = 'program_prices_brand_all') then
    raise exception '029: program_prices_brand_all tidak terbentuk';
  end if;
end $$;

commit;
