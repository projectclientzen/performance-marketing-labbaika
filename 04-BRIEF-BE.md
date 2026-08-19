# Brief Backend: Labbaika Reporting Platform

Sumber kebenaran produk: `02-PRD-v1.1.md`. Dokumen ini menetapkan stack, schema, kontrak API, dan aturan bisnis yang harus dieksekusi persis.

---

## 1. Stack

| Lapisan | Pilihan | Alasan |
|---|---|---|
| Runtime & API | Next.js 15 App Router, Route Handlers, TypeScript strict | satu repo dengan FE, mudah dideploy |
| Database | Supabase Postgres | RLS bawaan, sudah tersedia di tooling |
| Auth | Supabase Auth, cookie httpOnly | persistent login PWA |
| Validasi | Zod, dipakai di FE dan BE dari file skema yang sama | satu definisi, dua tempat |
| Migrasi | file SQL bernomor di `supabase/migrations` | jejak perubahan jelas |
| Query agregat | SQL view dan materialized view | logika metrik hidup di DB, tidak tersebar di TS |
| Deploy | Vercel | integrasi Next.js |
| Test | Vitest untuk unit, pgTAP atau SQL fixture untuk RLS | RLS wajib diuji, bukan diasumsikan |

Aturan: **semua logika metrik ditulis sekali di SQL view.** Route handler hanya memilih, memfilter, dan membentuk JSON. Kalau ada rumus conversion rate ditulis di TypeScript, itu bug.

---

## 2. Schema

Semua tabel operasional membawa `brand_id uuid not null`. Uang disimpan `bigint` rupiah penuh. Tanggal bisnis `date`, waktu sistem `timestamptz`.

### 2.1 Master

```sql
brands            (id, name, slug, status, created_at)
app_users         (id = auth.users.id, brand_id, full_name, role, is_active, created_at)
                  -- role: 'owner' | 'cs'
regions           (id, level, name, parent_id)          -- level: 'province' | 'city'
lead_sources      (id, brand_id, name, slug, is_active, sort_order)
insight_categories(id, brand_id, name, slug, is_active, sort_order)
```

### 2.2 Program

```sql
programs (
  id, brand_id, name, destination, duration_days,
  status, description, created_at, updated_at
)

program_departures (
  id, brand_id, program_id, departure_date, return_date,
  quota, status, created_at
)

program_prices (
  id, brand_id, program_id,
  departure_id NULL,
  room_type,               -- 'quad'|'triple'|'double'|'child'|'infant'
  price bigint,            -- harga jual, boleh dibaca CS
  effective_date date,
  end_date date NULL,
  status,
  created_at, created_by
)

-- TABEL SENSITIF. RLS owner-only. Jangan gabungkan ke program_prices,
-- karena CS punya akses SELECT ke tabel itu.
program_costs (
  id, brand_id, program_id,
  departure_id NULL,
  room_type,
  cost_price bigint,       -- HPP per pax: tiket, hotel, visa, handling, land arrangement
  effective_date date,
  end_date date NULL,
  status,
  note text,
  created_at, created_by
)

brand_settings (
  brand_id PRIMARY KEY,
  default_margin_pct numeric,   -- dipakai kalau HPP belum diisi
  auto_lock_days int DEFAULT 45,
  updated_at, updated_by
)
```

`program_costs` memakai constraint exclusion anti-overlap yang sama dengan `program_prices`.

Constraint anti-overlap (butuh extension `btree_gist`):

```sql
ALTER TABLE program_prices ADD CONSTRAINT program_prices_no_overlap
EXCLUDE USING gist (
  program_id WITH =,
  COALESCE(departure_id, '00000000-0000-0000-0000-000000000000'::uuid) WITH =,
  room_type WITH =,
  daterange(effective_date, COALESCE(end_date, 'infinity'::date), '[]') WITH &&
) WHERE (status = 'active');
```

### 2.3 Lead report

```sql
lead_reports (
  id, brand_id, cs_id, report_date date,
  source_id, campaign_id NULL,          -- NULL sah dan umum, lihat PRD 5.4
  campaign_key uuid GENERATED ALWAYS AS
    (COALESCE(campaign_id, '00000000-0000-0000-0000-000000000000'::uuid)) STORED,
  total_lead int, cold int, consultation int, offering int,
  closing int NOT NULL DEFAULT 0,        -- dikelola trigger, bukan input
  idempotency_key text,
  created_at, updated_at, created_by, updated_by,

  CONSTRAINT lead_reports_sum_check
    CHECK (cold + consultation + offering + closing = total_lead),
  CONSTRAINT lead_reports_nonneg
    CHECK (total_lead >= 0 AND cold >= 0 AND consultation >= 0
           AND offering >= 0 AND closing >= 0)
);

CREATE UNIQUE INDEX lead_reports_uniq
  ON lead_reports (brand_id, cs_id, report_date, source_id, campaign_key);

CREATE UNIQUE INDEX lead_reports_idem
  ON lead_reports (brand_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
```

```sql
lead_report_insights (
  id, brand_id, lead_report_id, stage, category_id, lead_count int, note text
);
CREATE UNIQUE INDEX ON lead_report_insights (lead_report_id, stage, category_id);
```
Batas `sum(lead_count) per (report, stage) <= jumlah lead pada stage tersebut` ditegakkan lewat trigger, tidak bisa lewat CHECK biasa.

### 2.4 Closing

```sql
closings (
  id, brand_id, cs_id,
  first_name, last_name NULL,
  whatsapp_raw, whatsapp_e164, email NULL,
  pdp_consent bool DEFAULT false, pdp_consent_at timestamptz NULL,

  lead_date date, source_id, campaign_id NULL,
  lead_report_id NULL REFERENCES lead_reports(id),
  previous_stage,                       -- 'cold'|'consultation'|'offering'

  closing_date date,
  program_id, departure_id, room_type, pax int,
  price_at_transaction bigint,
  total_value bigint,
  is_price_override bool DEFAULT false, price_note NULL,

  cost_at_transaction bigint NULL,        -- HPP per pax, dikunci saat closing
  cost_source,                            -- 'actual' | 'estimated' | 'unknown'
  cost_of_sales bigint GENERATED ALWAYS AS
    (COALESCE(cost_at_transaction,0) * pax) STORED,
  gross_profit bigint GENERATED ALWAYS AS
    (total_value - COALESCE(cost_at_transaction,0) * pax) STORED,

  payment_status,                       -- 'dp'|'partial'|'lunas'|'cancelled'|'refunded'
  paid_amount bigint DEFAULT 0,
  cancelled_at NULL, cancel_reason NULL,

  province_id NULL, city_id NULL, address NULL,
  interval_days int GENERATED ALWAYS AS (closing_date - lead_date) STORED,

  created_at, updated_at, created_by, updated_by,

  CONSTRAINT closing_after_lead CHECK (closing_date >= lead_date),
  CONSTRAINT closing_pax CHECK (pax > 0),
  CONSTRAINT closing_price CHECK (price_at_transaction >= 0),
  CONSTRAINT closing_paid CHECK (paid_amount >= 0 AND paid_amount <= total_value),
  CONSTRAINT closing_cost CHECK (cost_at_transaction IS NULL OR cost_at_transaction >= 0)
);

CREATE UNIQUE INDEX closings_dedup
  ON closings (brand_id, whatsapp_e164, departure_id)
  WHERE payment_status <> 'cancelled';
```

### 2.5 Ads

```sql
ad_accounts   (id, brand_id, external_id, name, status)
ad_campaigns  (id, brand_id, ad_account_id, external_id, name, objective, status)
ad_sets       (id, brand_id, ad_campaign_id, external_id, name, status)
ads           (id, brand_id, ad_set_id, external_id, name, status)

ad_performance (
  id, brand_id, level, entity_id, date,
  spend bigint, impressions bigint, reach bigint, clicks bigint,
  leads int, source, created_at
);
CREATE UNIQUE INDEX ON ad_performance (brand_id, level, entity_id, date);
```
CTR, CPC, CPM, CPL dihitung di view, tidak disimpan.

### 2.6 Sistem

```sql
period_locks (id, brand_id, year, month, locked_at, locked_by, unlock_reason)
export_logs  (id, brand_id, user_id, export_type, filters jsonb, row_count, created_at)
sync_logs    (id, brand_id, source, status, message, started_at, finished_at)
audit_logs   (id, brand_id, user_id, action, table_name, record_id,
              old_value jsonb, new_value jsonb, ip, created_at)
```

---

## 3. Trigger wajib

### T-1 `sync_closing_to_lead_report`
Pada INSERT, UPDATE, DELETE tabel `closings`.

- INSERT dengan `lead_report_id` terisi: `closing += 1`, kolom `previous_stage` `-= 1` pada report tersebut
- DELETE atau UPDATE `payment_status` menjadi `cancelled`: kebalikannya
- UPDATE yang memindahkan `lead_report_id`: batalkan efek di report lama, terapkan di report baru
- Kalau pengurangan membuat kolom stage jadi negatif, gagalkan transaksi dengan pesan: `stage {x} pada laporan {tanggal} tidak cukup untuk dikurangi`

### T-2 `resolve_lead_report_link`
BEFORE INSERT pada `closings`. Isi `lead_report_id` otomatis dengan pencarian `brand_id + cs_id + lead_date + source_id`. Kalau tidak ketemu, biarkan NULL.

### T-3 `validate_insight_total`
Pada INSERT dan UPDATE `lead_report_insights`. Jumlah per stage tidak boleh melebihi jumlah lead pada stage itu.

### T-4 `block_locked_period`
Pada INSERT, UPDATE, DELETE `lead_reports`, `lead_report_insights`, `closings`. Tolak kalau bulan dari `report_date` atau `closing_date` sudah terkunci dan pemanggilnya bukan owner.

**Pengecualian wajib:** koreksi otomatis dari trigger T-1 tidak boleh diblokir. T-1 menyalakan flag sesi `set_config('app.system_correction','on',true)` sebelum menulis ke `lead_reports` dan mematikannya setelah selesai. T-4 melewatkan tulisan saat flag menyala, lalu mencatat `cross_period_correction` ke audit log.

Tanpa pengecualian ini, closing bulan berjalan untuk lead bulan lalu akan gagal disimpan begitu periode lama terkunci.

### T-5 `write_audit_log`
Trigger generik pada tabel yang diaudit. Menyimpan old dan new sebagai jsonb.

### T-7 `lock_cost_at_closing`
BEFORE INSERT pada `closings`. Mengisi `cost_at_transaction` dari `program_costs` yang berlaku pada `closing_date` untuk kombinasi program, departure, room_type.

- Ketemu, isi nilainya, `cost_source = 'actual'`
- Tidak ketemu tapi `brand_settings.default_margin_pct` ada: `cost_at_transaction = round(price_at_transaction * (1 - default_margin_pct/100))`, `cost_source = 'estimated'`
- Dua-duanya kosong: `cost_at_transaction = NULL`, `cost_source = 'unknown'`, dan closing tetap tersimpan

Trigger ini berjalan di sisi server. CS tidak pernah mengirim, melihat, atau bisa mengubah nilai HPP. Setelah tersimpan, nilai tidak pernah dibaca ulang dari master.

### T-6 `normalize_whatsapp`
BEFORE INSERT/UPDATE `closings`. Ubah `whatsapp_raw` menjadi E.164 Indonesia: buang spasi, tanda hubung, dan kurung; `08...` menjadi `+628...`; `628...` menjadi `+628...`; `+62` dibiarkan. Kalau hasilnya tidak cocok pola `^\+62[8][1-9][0-9]{6,10}$`, tolak.

---

## 4. Row Level Security

Aktif di semua tabel operasional.

```
owner : boleh SELECT/INSERT/UPDATE/DELETE semua baris dengan brand_id = brand miliknya
cs    : SELECT/INSERT/UPDATE hanya baris dengan brand_id = brand miliknya AND cs_id = auth.uid()
        SELECT saja untuk programs, program_departures, program_prices,
        lead_sources, insight_categories, regions
        tidak punya akses apapun ke ad_performance, export_logs, audit_logs,
        period_locks, program_costs, brand_settings,
        app_users milik orang lain
```

Uji wajib: login sebagai CS lalu coba baca closing milik CS lain lewat query langsung. Harus kosong, bukan error.

Uji kedua yang tidak boleh dilewat: CS membaca `program_costs` harus kosong, dan CS membaca closing miliknya sendiri **tidak boleh** memunculkan kolom `cost_at_transaction`, `cost_of_sales`, dan `gross_profit`. Karena RLS Postgres bekerja per baris bukan per kolom, sajikan closing untuk CS lewat view `v_closings_cs` yang tidak menyertakan ketiga kolom itu, dan cabut hak SELECT CS pada tabel `closings` secara langsung.

---

## 5. View metrik

Semua rumus hidup di sini. Route handler tidak boleh menghitung ulang.

### `v_lead_funnel_daily`
Per (brand, tanggal, cs, source, campaign):
```sql
total_lead,
cold, consultation, offering, closing,
consultation + offering + closing         AS reached_consultation,
offering + closing                        AS reached_offering,
closing                                   AS reached_closing,
NULLIF(total_lead,0)                      -- pembagi aman untuk semua rate
```
Rate dihitung di view turunannya, selalu `NULLIF` pembagi supaya tidak division by zero.

### `v_closing_enriched`
Closing digabung program, departure, region, cs, ditambah `interval_days`, `is_cancelled`, `revenue_gross` (`total_value` kalau tidak cancelled, else 0), `cost_of_sales`, `gross_profit`, dan `cost_source`.

### `v_closings_cs`
Versi terbatas untuk role CS. Tanpa kolom biaya dan profit. Ini satu-satunya jalur baca closing untuk CS.

### `v_sales_by_closing_date` (cash basis)
Agregasi `v_closing_enriched` berdasarkan `closing_date`.

### `v_sales_by_lead_date` (cohort basis)
Agregasi yang sama berdasarkan `lead_date`.

### `v_ads_daily`
```sql
spend, impressions, reach, clicks,
clicks::numeric / NULLIF(impressions,0)       AS ctr,
spend::numeric  / NULLIF(clicks,0)            AS cpc,
spend::numeric  / NULLIF(impressions,0)*1000  AS cpm,
spend::numeric  / NULLIF(leads,0)             AS cpl_meta
```

### `v_profitability`
Agregasi profit pada dimensi apapun (periode, campaign, source, CS, program).

```sql
sum(gross_profit)                                        AS gross_profit,
sum(gross_profit)::numeric / NULLIF(sum(revenue),0)      AS margin_pct,
sum(gross_profit) - sum(spend)                           AS net_contribution,
(sum(gross_profit) - sum(spend))::numeric
   / NULLIF(sum(spend),0)                                AS roi,
sum(spend)::numeric / NULLIF(count(closing),0)           AS cpp,
sum(gross_profit)::numeric / NULLIF(count(closing),0)    AS breakeven_cpp,
sum(spend)::numeric / NULLIF(sum(revenue),0)             AS ad_cost_ratio,
sum(revenue) FILTER (WHERE cost_source='actual')::numeric
   / NULLIF(sum(revenue),0)                              AS cost_coverage_rate
```

`roi` dikembalikan sebagai rasio desimal. Konversi ke persen dilakukan di layer presentasi, satu tempat saja.

Tidak ada view atau endpoint yang mengembalikan ROAS. Kalau muncul di kode, itu sisa yang harus dihapus.

### `v_campaign_quality`
Gabungan `v_ads_daily`, `v_lead_funnel_daily`, `v_sales_by_lead_date`, dan `v_profitability` pada level campaign. Menghasilkan CPL (dua versi), CPP, break-even CPP, ROI cohort, dan seluruh rate funnel.

Wajib menyertakan kolom `campaign_attribution_rate` = lead dengan `campaign_id` terisi dibagi total lead pada periode dan filter yang sama. Endpoint dashboard meneruskan angka ini ke `meta` supaya UI bisa memperingatkan. Lead tanpa campaign dikelompokkan sebagai baris `(tidak teratribusi)`, tidak dibuang dan tidak disebar proporsional.

### `v_cs_performance`
Per CS: bucket, funnel rate, closing, gross booking value, average dan median interval, cancellation rate, report compliance.

### `v_cohort_maturity`
Persentase kematangan cohort per bulan berdasarkan median interval historis. Dipakai untuk banner peringatan di dashboard.

---

## 6. Kontrak API

Semua respons memakai amplop yang sama:
```json
{ "data": ..., "error": null, "meta": { "page": 1, "total": 0 } }
```
Error:
```json
{ "data": null, "error": { "code": "VALIDATION_FAILED", "message": "...",
  "fields": { "cold": "..." } } }
```

Kode error yang dipakai: `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_FAILED`, `DUPLICATE_CONFLICT`, `PERIOD_LOCKED`, `STAGE_UNDERFLOW`, `PRICE_NOT_FOUND`, `RATE_LIMITED`, `INTERNAL`.

### Endpoint

```
POST   /api/auth/session                    login
DELETE /api/auth/session                    logout
GET    /api/me                              profil + role + brand

GET    /api/lead-reports?date=&cs=&from=&to=
POST   /api/lead-reports                    body: { date, blocks[], idempotency_key }
PATCH  /api/lead-reports/:id
GET    /api/lead-reports/:id/insights
PUT    /api/lead-reports/:id/insights       replace-all per stage

GET    /api/closings?from=&to=&cs=&program=&status=
POST   /api/closings                        409 DUPLICATE_CONFLICT + detail bentrok
PATCH  /api/closings/:id
POST   /api/closings/:id/cancel             body: { reason }
GET    /api/closings/unlinked
POST   /api/closings/:id/link               body: { lead_report_id, previous_stage }

GET    /api/programs
POST   /api/programs
GET    /api/programs/:id/departures
POST   /api/programs/:id/departures
GET    /api/programs/:id/prices
POST   /api/programs/:id/prices
GET    /api/programs/:id/costs               owner-only
POST   /api/programs/:id/costs               owner-only
GET    /api/brand-settings                   owner-only
PATCH  /api/brand-settings                   owner-only
GET    /api/price-lookup?program_id=&departure_id=&room_type=&date=

GET    /api/dashboard/overview?from=&to=&attribution=cash|cohort&source=&campaign=
GET    /api/dashboard/funnel
GET    /api/dashboard/campaigns
GET    /api/dashboard/profitability
GET    /api/dashboard/cs-performance
GET    /api/dashboard/insights
GET    /api/dashboard/reconciliation

GET    /api/reports/monthly?year=&month=&...
POST   /api/exports/operational              stream CSV, catat ke export_logs
POST   /api/exports/meta-ltv                 stream CSV terhash, hanya consent = true

POST   /api/ads/import                       upload CSV
GET    /api/master/{sources|insight-categories|regions}
POST   /api/period-locks
DELETE /api/period-locks/:id                 body: { reason }
GET    /api/audit-logs
```

### Aturan endpoint penting

`POST /api/lead-reports` menerima seluruh blok source dalam satu permintaan dan menulisnya dalam satu transaksi. Kalau satu blok gagal validasi, tidak ada yang tersimpan. Respons mengembalikan seluruh baris yang tersimpan beserta nilai `closing` hasil hitungan sistem.

`POST /api/closings` mengembalikan 409 dengan payload berisi CS, tanggal, dan program dari closing yang bentrok. Klien menampilkan modal. Permintaan ulang dengan `force: true` hanya diterima kalau pemanggilnya owner.

`GET /api/price-lookup` memakai `date` = `closing_date`. Kalau tidak ada harga aktif, balas `PRICE_NOT_FOUND` supaya FE membuka mode input manual.

---

## 7. Export Meta LTV

Pipeline: query → filter consent → normalisasi → hashing → CSV.

Normalisasi sebelum hash:
- semua nilai di-trim dan diubah ke huruf kecil
- telepon: E.164 tanpa tanda plus, contoh `6281234567890`
- nama: buang gelar dan tanda baca
- kolom kosong tetap kosong, jangan diisi string "null"

Hash: SHA-256, keluaran hex huruf kecil.

Kolom yang dikirim: phone, email, first name, last name, city, state, country, plus kolom nilai `value` dan `currency` untuk kebutuhan value-based audience.

Formatter berada di `lib/exports/meta/` terpisah dari akses database, sehingga perubahan format Meta tidak menyentuh schema. Verifikasi daftar kolom ke dokumentasi Meta terbaru sebelum rilis.

---

## 8. Urutan pengerjaan

```
1. Migrasi schema + seed master
2. RLS + pengujian RLS
3. Auth + /api/me
4. Lead report (create, list, patch) + trigger period lock
5. Closing + trigger T-1, T-2, T-6 + dedup
6. Program, departure, price + price-lookup
6b. Program cost + brand settings + trigger penguncian HPP
7. View metrik
8. Endpoint dashboard
9. Export operational
10. Export Meta LTV
11. Ads import
12. Audit log + period lock UI
```

Nomor 4 dan 5 adalah inti sistem. Selesaikan dan uji sampai benar sebelum menyentuh dashboard.
