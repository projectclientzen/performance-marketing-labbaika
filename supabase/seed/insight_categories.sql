-- DS-03: Seed kategori insight — alasan lead TIDAK closing (02-PRD-v1.3.md §6)
-- 15 kategori sesuai PRD §6. Idempotent.
insert into insight_categories (brand_id, slug, name, sort_order)
select b.id, v.slug, v.name, v.sort_order
from brands b
cross join (values
  ('harga', 'Harga', 1),
  ('program', 'Program', 2),
  ('jadwal_keberangkatan', 'Jadwal keberangkatan', 3),
  ('itinerary', 'Itinerary', 4),
  ('hotel', 'Hotel', 5),
  ('tiket', 'Tiket', 6),
  ('visa', 'Visa', 7),
  ('fasilitas', 'Fasilitas', 8),
  ('pembayaran_dp', 'Pembayaran/DP', 9),
  ('promo', 'Promo', 10),
  ('banding_travel', 'Membandingkan travel', 11),
  ('diskusi_keluarga', 'Diskusi pasangan/keluarga', 12),
  ('menunggu_keputusan', 'Menunggu keputusan', 13),
  ('belum_tentukan_tanggal', 'Belum menentukan tanggal', 14),
  ('lainnya', 'Lainnya', 15)
) as v(slug, name, sort_order)
where b.slug = 'labbaika'
on conflict (brand_id, slug) do nothing;
