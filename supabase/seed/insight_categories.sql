-- DS-03: Seed kategori insight
-- DRAFT: daftar final WAJIB dicek ke 02-PRD-v1.1.md §6 saat tersedia.
-- 15 kategori untuk tagging insight di dashboard. Idempotent.
INSERT INTO insight_categories (slug, name, sort_order) VALUES
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
ON CONFLICT (slug) DO NOTHING;
