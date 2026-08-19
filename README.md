# Performance Marketing — Labbaika

Dashboard & operasional performance marketing Labbaika Cipta Imani: manajemen lead,
laporan harian CS, closing, dan export data ke Meta Ads.

> Status: **early development**. Struktur folder sedang dibangun oleh beberapa
> agent (Claude Code = major, DeepSeek/Aksa = minor). Detail arsitektur final
> mengikuti PRD (`02-PRD-v1.1/v1.3.md`) dan brief (`03-BRIEF-FE-ClaudeDesign.md`,
> `04-BRIEF-BE.md`) — file tersebut menyusul.

## Stack

- Next.js 14 (App Router) + TypeScript (strict)
- Zod — skema validasi dipakai bersama FE & BE
- Supabase (PostgreSQL) — database & seed
- Vitest — unit test

## Menjalankan lokal

```bash
npm install
cp .env.example .env.local   # isi nilai sesuai environment
npm run dev                  # http://localhost:3000
```

## Env

Salin `.env.example` ke `.env.local`. Variabel:

| Variabel | Keterangan |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL project Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key Supabase (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key — **hanya di server, jangan pernah di client** |
| `META_ACCESS_TOKEN` | Token akses Meta Marketing API (untuk export/import iklan) |

## Migrasi & seed

```bash
# Migrasi schema dikelola oleh Claude Code (folder supabase/migrations).
# Seed data referensi (wajib dijalankan setelah migrasi):
psql "$DATABASE_URL" -f supabase/seed/lead_sources.sql
psql "$DATABASE_URL" -f supabase/seed/insight_categories.sql
psql "$DATABASE_URL" -f supabase/seed/regions.sql
```

Seed idempotent (`ON CONFLICT DO NOTHING`) — aman dijalankan ulang.
`regions.sql` di-generate dari `scripts/gen_regions.py` (38 provinsi + 514 kab/kota,
kode wilayah resmi Kemendagri).

## Test

```bash
npm test            # vitest run (sekali)
npm run test:watch  # mode watch
```

Setiap fungsi murni di `lib/` wajib punya file `*.test.ts` berdampingan.

## Struktur folder

```
app/                  # Halaman (Next.js App Router) — menyusul
components/ui/        # Komponen UI (menunggu desain disetujui)
lib/
  api/envelope.ts     # Amplop respons API (ok/fail + HTTP status)
  constants/          # Enum, label, warna token, pesan error
  exports/
    meta/             # Normalisasi + hash + kolom export Meta
    operational/      # Kolom export operational
  schemas/            # Skema Zod (dipakai FE & BE)
  utils/              # Fungsi murni: rupiah, tanggal, phone, CSV, profit, funnel
scripts/
  gen_regions.py      # Generator seed regions
  seed-dev.ts         # Data dummy development (menyusul)
supabase/
  seed/               # Seed data referensi
```

## Batasan kontribusi (task minor / DeepSeek)

- Tidak menyentuh migrasi berisi trigger/constraint exclusion/RLS
- Tidak menyentuh SQL agregat/view/rumus metrik
- Tidak menyentuh endpoint yang menulis ke database
- Tidak menyentuh autentikasi/permission
- Maksimal 3 file per task — di luar itu, kembali ke Claude Code
