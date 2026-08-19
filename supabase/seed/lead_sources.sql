-- DS-02: Seed lead sources
-- Sumber lead yang dipakai di laporan harian. Idempotent.
INSERT INTO lead_sources (slug, name, sort_order) VALUES
  ('facebook_lp', 'Facebook LP', 1),
  ('facebook_ctwa', 'Facebook CTWA', 2),
  ('google', 'Google', 3),
  ('organic', 'Organic', 4),
  ('referral', 'Referral', 5),
  ('other', 'Other', 6)
ON CONFLICT (slug) DO NOTHING;
