-- DS-02: Seed lead sources
-- Sumber lead yang dipakai di laporan harian. Idempotent.
--
-- Fixed: original version inserted without brand_id, but lead_sources.brand_id
-- is NOT NULL (04-BRIEF-BE.md §2.1) and the real unique constraint is
-- (brand_id, slug), not slug alone -- `ON CONFLICT (slug)` would have errored
-- with "no unique or exclusion constraint matching". Run 00_brand.sql first.
insert into lead_sources (brand_id, slug, name, sort_order)
select b.id, v.slug, v.name, v.sort_order
from brands b
cross join (values
  ('facebook_lp', 'Facebook LP', 1),
  ('facebook_ctwa', 'Facebook CTWA', 2),
  ('google', 'Google', 3),
  ('organic', 'Organic', 4),
  ('referral', 'Referral', 5),
  ('other', 'Other', 6)
) as v(slug, name, sort_order)
where b.slug = 'labbaika'
on conflict (brand_id, slug) do nothing;
