-- Proof for CC-B03 "selesai kalau": overlapping active price periods for the
-- same (program, departure, room_type) are rejected by the database.
-- Run manually against a scratch DB after applying migration 002.

begin;

insert into brands (name, slug) values ('Labbaika Group', 'labbaika-price-test');
insert into programs (brand_id, name, destination, duration_days)
  select id, 'Umroh Turki 16D', 'Turki', 16 from brands where slug = 'labbaika-price-test';
insert into program_departures (brand_id, program_id, departure_date)
  select b.id, p.id, '2026-10-12'
  from brands b join programs p on p.brand_id = b.id
  where b.slug = 'labbaika-price-test';

-- Baseline price: quad, effective 2026-08-01 open-ended.
insert into program_prices (brand_id, program_id, departure_id, room_type, price, effective_date)
select b.id, p.id, d.id, 'quad', 32900000, '2026-08-01'
from brands b
join programs p on p.brand_id = b.id
join program_departures d on d.program_id = p.id
where b.slug = 'labbaika-price-test';

-- This must be REJECTED: same program+departure+room_type, overlapping range.
do $$
begin
  insert into program_prices (brand_id, program_id, departure_id, room_type, price, effective_date)
  select b.id, p.id, d.id, 'quad', 33900000, '2026-09-01'
  from brands b
  join programs p on p.brand_id = b.id
  join program_departures d on d.program_id = p.id
  where b.slug = 'labbaika-price-test';

  raise exception 'TEST FAILED: overlapping price period was accepted';
exception
  when exclusion_violation then
    raise notice 'TEST PASSED: overlap correctly rejected (%)', sqlerrm;
end $$;

-- Non-overlapping price for the same combination must succeed (end_date closes the gap).
update program_prices set end_date = '2026-08-31'
where room_type = 'quad' and effective_date = '2026-08-01';

insert into program_prices (brand_id, program_id, departure_id, room_type, price, effective_date)
select b.id, p.id, d.id, 'quad', 33900000, '2026-09-01'
from brands b
join programs p on p.brand_id = b.id
join program_departures d on d.program_id = p.id
where b.slug = 'labbaika-price-test';

do $$
begin
  if (select count(*) from program_prices) <> 2 then
    raise exception 'TEST FAILED: expected 2 non-overlapping prices, got %', (select count(*) from program_prices);
  end if;
  raise notice 'TEST PASSED: non-overlapping period accepted, total rows = 2';
end $$;

rollback;
