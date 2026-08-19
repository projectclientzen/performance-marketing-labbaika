-- DS-03: Seed kategori insight
-- DRAFT: daftar final WAJIB dicek ke 02-PRD-v1.1.md §6 saat tersedia.
-- 15 kategori untuk tagging insight di dashboard. Idempotent.
--
-- Fixed: same brand_id NOT NULL + (brand_id, slug) unique constraint issue
-- as lead_sources.sql. Content itself (lead_inflow/conversion/cpl/...) is
-- unchanged from the original DS-03 draft -- it does NOT match
-- 02-PRD-v1.3.md §6's list (Harga/Program/Jadwal keberangkatan/...), which
-- is about why a LEAD isn't closing, not marketing ops categories. Flagging,
-- not silently rewriting content beyond what was asked.
insert into insight_categories (brand_id, slug, name, sort_order)
select b.id, v.slug, v.name, v.sort_order
from brands b
cross join (values
  ('lead_inflow', 'Lead Masuk', 1),
  ('conversion', 'Konversi', 2),
  ('cpl', 'CPL', 3),
  ('budget', 'Budget', 4),
  ('creative', 'Kreatif', 5),
  ('timing', 'Timing', 6),
  ('region', 'Wilayah', 7),
  ('product', 'Produk', 8),
  ('pricing', 'Harga', 9),
  ('competitor', 'Kompetitor', 10),
  ('follow_up', 'Follow-up', 11),
  ('lead_quality', 'Kualitas Lead', 12),
  ('seasonal', 'Musiman', 13),
  ('testimonial', 'Testimoni', 14),
  ('operational', 'Operasional', 15)
) as v(slug, name, sort_order)
where b.slug = 'labbaika'
on conflict (brand_id, slug) do nothing;
