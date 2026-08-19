# PRD Labbaika Group Reporting Platform

Version: MVP v1.3
Status: siap dieksekusi
Perubahan dari v1.0: 20 fix dari `01-AUDIT-PRD.md`
Perubahan dari v1.1: 3 fix lanjutan (§3.4 keterbatasan aggregate, §5.4 atribusi campaign, §13 konflik period lock)
Perubahan dari v1.2: ROAS diganti ROI. Menambah HPP, gross profit, dan break-even CPP (§9)
Platform: Web App + PWA, mobile first
Role: CS dan Owner/Advertiser

---

## 1. Ringkasan

Sistem menggantikan spreadsheet CS Labbaika Group dan menyambungkan rantai:

```
Ad Spend → Lead → Lead Quality → CS → Closing → Revenue → LTV Export
```

Prinsip pencatatan: **aggregate dulu, individual saat closing**. CS mencatat jumlah lead per stage tanpa nama. Begitu closing, customer dicatat individual.

---

## 2. Konstanta sistem

| Konstanta | Nilai | Alasan |
|---|---|---|
| `APP_TIMEZONE` | `Asia/Jakarta` | semua penentuan "hari ini" dan agregasi |
| `CURRENCY` | IDR, `bigint`, tanpa desimal | hindari floating point |
| Tanggal bisnis | tipe `DATE` | tidak ada konversi zona |
| Timestamp audit | `timestamptz` | jejak waktu presisi |
| Format telepon simpan | E.164 (`+628xxxxxxxxxx`) | syarat export Meta dan dedup |

---

## 3. Model stage: bucket vs funnel

### 3.1 Yang diinput CS (bucket eksklusif)

Setiap lead menempati **satu** bucket, yaitu stage terjauh yang dia capai.

| Stage | Label | Definisi |
|---|---|---|
| `cold` | No Response | belum merespons |
| `consultation` | Hot | aktif berkonsultasi |
| `offering` | Prospect | sudah masuk tahap penawaran |
| `closing` | Won | sudah transaksi |

Invarian:
```
cold + consultation + offering + closing = total_lead
```

### 3.2 Yang dihitung sistem (funnel kumulatif)

Jangan pernah menampilkan bucket mentah sebagai conversion rate.

```
reached_lead         = total_lead
reached_consultation = consultation + offering + closing
reached_offering     = offering + closing
reached_closing      = closing

rate_lead_to_consult  = reached_consultation / reached_lead
rate_consult_to_offer = reached_offering      / reached_consultation
rate_offer_to_closing = reached_closing       / reached_offering
closing_rate          = closing               / total_lead
```

Di UI, bucket mentah diberi label "lead berhenti di stage ini", metrik funnel diberi label "% lanjut ke stage berikutnya".

### 3.3 Perpindahan stage lintas hari

Kolom `closing` pada laporan harian **tidak diinput CS**. Nilainya dikelola sistem.

Alur:
1. CS input closing baru, mengisi `lead_date`.
2. Sistem mencari `lead_report` yang cocok: brand + cs + `lead_date` + source.
3. Sistem menanyakan stage sebelumnya, default `offering`.
4. Trigger: `closing += 1`, `previous_stage -= 1` pada laporan tanggal tersebut. `total_lead` tetap.
5. Jika tidak ada laporan yang cocok, closing disimpan dengan `lead_report_id = NULL` dan muncul di panel **Unlinked Closings** milik Owner.

Validasi form harian CS jadi:
```
cold + consultation + offering = total_lead - closing_auto
```

### 3.4 Keterbatasan yang diketahui: perpindahan stage selain closing

Koreksi otomatis di §3.3 hanya berlaku untuk lead yang closing. Lead yang naik dari Cold ke Consultation di hari berikutnya tidak terkoreksi, karena tanpa identitas lead sistem tidak tahu lead mana yang naik.

Akibatnya `reached_consultation` dan `reached_offering` cenderung **understate**, sementara `closing` akurat. Ini konsekuensi sadar dari model aggregate. Jangan diperbaiki dengan menambah field, perbaiki dengan konvensi kerja.

**Konvensi CS:**
- Stage yang dicatat adalah stage terjauh yang dicapai lead **sampai laporan disimpan**
- CS boleh mengedit laporan sampai H-7 kalau ada lead yang naik stage. Formnya menyediakan tombol "Koreksi laporan lama" di beranda dengan daftar 7 hari terakhir
- Koreksi bersifat opsional. Kalau tidak dikoreksi, angkanya tetap sah, hanya konservatif

**Aturan baca dashboard:**
- `closing_rate` (closing dibagi total lead) adalah metrik paling bisa dipercaya. Jadikan ini metrik utama untuk membandingkan campaign dan CS
- `rate_lead_to_consult` dan `rate_consult_to_offer` adalah indikator arah, bukan angka absolut. Beri label "estimasi" di UI
- Metrik akurat penuh untuk seluruh tahap funnel baru tersedia di Phase 2 saat individual lead tracking aktif

---

## 4. Role dan permission

### Owner / Advertiser
Akses penuh terhadap brand: seluruh dashboard, seluruh data CS, ads performance, program, harga, export, master data, settings, period lock, audit log.

### CS
Akses: laporan harian miliknya, lead insight miliknya, closing miliknya, program, harga, performa pribadi.

CS tidak melihat: ad spend, revenue perusahaan, HPP, margin, ROI, performa CS lain.

HPP dan margin adalah data paling sensitif di sistem ini. Simpan di tabel terpisah dengan RLS owner-only, jangan sebagai kolom di tabel harga yang dibaca CS.

Penegakan di level database (row level security), bukan hanya di UI.

`cs_id` selalu diisi dari user yang login. Field CS tidak muncul di form CS. Owner boleh memilih CS lain, tercatat di audit log.

---

## 5. Laporan harian CS

### 5.1 Struktur

Satu halaman berisi N blok source. Satu blok = satu baris `lead_reports`.

Per blok:
- Source (wajib)
- Campaign (opsional)
- Total Lead
- Cold
- Consultation
- Offering
- Closing (read-only, auto)

Header halaman menampilkan grand total hari itu sebagai kontrol visual.

### 5.2 Anti duplikat

```sql
UNIQUE (brand_id, cs_id, report_date, source_id, campaign_key)
```
`campaign_key` adalah generated column: `COALESCE(campaign_id, '00000000-0000-0000-0000-000000000000')`.

Client mengirim `idempotency_key` per submit agar retry saat sinyal jelek aman.

### 5.3 Source (master data)

MVP: Facebook LP, Facebook CTWA, Google, Organic, Referral, Other. Owner bisa menambah.

### 5.4 Atribusi campaign: batas kemampuan CS

Masalah nyata: CS tidak tahu lead datang dari campaign mana. Chat CTWA masuk begitu saja tanpa penanda. Kalau dropdown campaign disediakan tanpa penanda, CS akan menebak, dan seluruh dashboard Campaign Quality jadi tidak bisa dipercaya.

**Aturan MVP:**

1. **Source wajib, campaign opsional.** Metrik yang dijamin akurat berhenti di level source.
2. **Campaign hanya boleh diisi kalau ada penanda yang bisa dilihat CS.** Tiga jalur yang layak:
   - **CTWA**: pasang `ref` parameter berbeda per campaign di setelan iklan. Pesan pertama WhatsApp membawa penanda ini. CS menyalin kodenya, atau memilih dari dropdown yang labelnya sama persis dengan kode.
   - **Landing page**: form menyimpan `utm_campaign` dan menampilkannya ke CS di notifikasi lead.
   - **Nomor WhatsApp terpisah per campaign besar**, kalau volume memang cukup untuk itu.
3. **Kalau tidak ada penanda, kosongkan.** Sistem menghitung `campaign_attribution_rate` dan menampilkannya di dashboard. Kalau di bawah 60%, tampilkan peringatan: "Perbandingan campaign hanya mencakup 42% lead. Angka di bawah belum mewakili keseluruhan."
4. **Jangan pernah menyebar sisa lead tanpa campaign secara proporsional.** Itu mengarang data.

Konsekuensi: dashboard Campaign Quality (§11) baru berfungsi penuh setelah penanda `ref` dipasang di semua campaign. Ini pekerjaan advertiser, bukan pekerjaan developer, dan harus selesai sebelum MVP dipakai untuk keputusan budget.

---

## 6. Lead Insight

Opsional, per stage.

```
lead_report_insights (id, lead_report_id, stage, category_id, lead_count, note)
```

Aturan: `sum(lead_count) per (report, stage) <= jumlah lead di stage tersebut`.

Kategori MVP: Harga, Program, Jadwal keberangkatan, Itinerary, Hotel, Tiket, Visa, Fasilitas, Pembayaran/DP, Promo, Membandingkan travel, Diskusi pasangan/keluarga, Menunggu keputusan, Belum menentukan tanggal, Lainnya. Owner bisa menambah.

Dashboard "Top Reason Not Closing" menghitung persentase dari **total insight terisi**, dan menampilkan denominatornya secara eksplisit. Contoh: "Harga 32% (dari 412 lead yang diberi insight, 66% dari total lead)".

---

## 7. Program, keberangkatan, harga

### 7.1 Struktur

```
programs           (id, brand_id, name, destination, duration_days, status, description)
program_departures (id, program_id, departure_date, return_date, quota, status)
program_prices     (id, program_id, departure_id NULL, room_type,
                    price, effective_date, end_date NULL, status)
```

`room_type`: `quad` / `triple` / `double` / `child` / `infant`.

### 7.2 Aturan harga

- Constraint exclusion mencegah overlap periode per (program, departure, room_type).
- `end_date` NULL berarti berlaku terbuka.
- Prefill di form closing memakai harga yang berlaku pada **`closing_date`**.
- Nilai disalin ke `closings.price_at_transaction`. Master price tidak pernah dibaca ulang untuk transaksi lama.
- Kalau lookup kosong, form tetap jalan dengan input manual dan flag override.

---

## 8. Closing Tracker

### 8.1 Field

Customer:
- `first_name`, `last_name` (dipisah, untuk match rate Meta)
- `whatsapp_raw` dan `whatsapp_e164`
- `email` (opsional)
- `pdp_consent` boolean, `pdp_consent_at`

Lead:
- `lead_date`, `source_id`, `campaign_id` (opsional), `previous_stage`

Closing:
- `closing_date`, `program_id`, `departure_id`, `room_type`, `pax`
- `price_at_transaction`, `total_value`, `is_price_override`, `price_note`
- `payment_status`: `dp` / `partial` / `lunas` / `cancelled` / `refunded`
- `paid_amount`, `cancelled_at`, `cancel_reason`

Lokasi:
- `province_id`, `city_id` (dari tabel `regions`), `address` opsional

### 8.2 Perhitungan

```
interval_days = closing_date - lead_date        (closing hari yang sama = 0)
total_value   = price_at_transaction * pax      (kecuali is_price_override = true)
```

### 8.3 Deteksi duplikat

Index unik parsial: `(brand_id, whatsapp_e164, departure_id) WHERE payment_status <> 'cancelled'`.

Saat bentrok, tampilkan peringatan berisi nama CS dan tanggal closing sebelumnya. Simpan tetap bisa dilakukan setelah konfirmasi Owner (kasus PIC rombongan).

### 8.4 Validasi

- Wajib: first_name, whatsapp, lead_date, closing_date, program, departure, pax
- `closing_date >= lead_date`
- `pax > 0`
- `price >= 0`
- `paid_amount <= total_value`

---

## 9. Revenue, profit, dan attribution

Sistem tidak memakai ROAS. Alasannya: paket umroh punya margin tipis, sehingga ROAS 84x terdengar luar biasa padahal bisa saja hanya menyisakan untung tipis setelah tiket, hotel, visa, dan handling dibayar. Angka yang dipakai untuk keputusan budget adalah **ROI**, yang berbasis gross profit, bukan omzet.

### 9.1 Tiga angka uang

| Metrik | Rumus | Kegunaan |
|---|---|---|
| Gross Booking Value | `sum(total_value)` non-cancelled | ukuran volume penjualan |
| Collected Revenue | `sum(paid_amount)` | uang yang benar-benar masuk |
| Gross Profit | `sum(total_value - cost_of_sales)` non-cancelled | dasar seluruh perhitungan ROI |
| Cancellation Rate | `cancelled / total closing` | kualitas closing |

`cost_of_sales` adalah HPP paket: `cost_at_transaction × pax`. Sumbernya tabel `program_costs`, dikunci pada saat closing sama seperti harga jual, sehingga perubahan HPP di kemudian hari tidak mengubah profit transaksi lama.

### 9.2 Metrik ROI

| Metrik | Rumus | Cara baca |
|---|---|---|
| Gross Profit | `revenue - cost_of_sales` | untung kotor sebelum biaya iklan |
| Net Contribution | `gross_profit - ad_spend` | untung setelah biaya iklan |
| **ROI** | `(gross_profit - ad_spend) / ad_spend` | ditampilkan sebagai persen. 0% berarti balik modal |
| Margin % | `gross_profit / revenue` | seberapa tebal paketnya |
| Profit per Closing | `gross_profit / jumlah closing` | untung rata-rata satu transaksi |
| **Break-even CPP** | `gross_profit / jumlah closing` | batas maksimum biaya per closing sebelum rugi |
| CPP | `ad_spend / jumlah closing` | biaya aktual per closing |
| Ad Cost Ratio | `ad_spend / revenue` | porsi omzet yang habis untuk iklan |

Break-even CPP adalah metrik keputusan utama. Kalimat yang harus bisa dijawab dashboard: "masih untung selama CPP di bawah Rp3.360.000, sekarang CPP kamu Rp333.000."

Tampilkan CPP dan Break-even CPP berdampingan dalam satu kartu, dengan indikator jarak keduanya.

### 9.3 Kalau HPP belum diisi

Owner mengisi HPP per program dan per keberangkatan. Selama HPP kosong, sistem memakai `default_margin_pct` di setelan brand sebagai perkiraan.

Aturan:
- Setiap angka ROI yang memakai perkiraan margin diberi tanda `estimasi` di UI
- Dashboard menampilkan `cost_coverage_rate` = porsi revenue yang HPP-nya sudah terisi
- Jangan sembunyikan angkanya, jangan juga menampilkannya seolah pasti

### 9.4 Dua mode attribution

| Mode | Revenue dan profit diakui pada | Default di |
|---|---|---|
| Cash basis | `closing_date` | Management Report |
| Cohort basis | `lead_date` | Campaign Quality, ROI keputusan budget |

Dashboard menampilkan toggle dan label mode aktif. Di mode cohort, tampilkan indikator kematangan cohort berbasis `median_closing_interval`.

### 9.5 CPL

Tampilkan dua angka terpisah: `CPL (Meta)` dari data ads, `CPL (CS-reported)` dari laporan harian, plus `lead_capture_gap %`.

---

## 10. Dashboard Owner

### A. Ads Performance
Spend, Impression, Reach, Click, CTR, CPC, CPM, Leads (Meta), CPL (Meta).

### B. Lead Quality
Total Lead, distribusi bucket (Cold/Consultation/Offering/Closing) dengan persentase, dan metrik funnel kumulatif dari §3.2.

### C. Sales
Total Closing, Total Pax, Gross Booking Value, Collected Revenue, Gross Profit, Margin %, Net Contribution, ROI, CPP, Break-even CPP, Ad Cost Ratio, Cancellation Rate, Highest Sale, Average Transaction, Profit per Closing, Median Closing Interval.

Kartu utama yang diberi aksen brass adalah **ROI**, bukan revenue.

### D. Lead Intelligence
Top Discussion, Top Reason Not Closing, Program Interest, Lead Quality per Source, Lead Quality per Campaign.

### E. Reconciliation
Unlinked Closings, laporan yang gagal validasi, laporan hari ini yang belum masuk per CS.

### Funnel visual
```
SPEND → LEAD → reached_consultation → reached_offering → reached_closing → REVENUE
```
Angka di setiap tahap adalah nilai kumulatif, bukan bucket.

---

## 11. Campaign Quality

Perbandingan antar campaign memakai metrik funnel kumulatif dan cohort ROI.

Contoh yang benar untuk kasus §19 PRD v1.0:

Asumsi contoh: paket Rp32.900.000, margin kotor 12%, gross profit per closing Rp3.948.000.

| | Campaign A | Campaign B |
|---|---|---|
| Spend | Rp5.000.000 | Rp5.000.000 |
| Lead | 500 | 250 |
| CPL | Rp10.000 | Rp20.000 |
| Reached consultation | 150 (30%) | 200 (80%) |
| Reached offering | 50 (33% dari consult) | 100 (50% dari consult) |
| Closing | 10 (20% dari offering) | 30 (30% dari offering) |
| Closing rate overall | 2,0% | 12,0% |
| Gross Booking Value | Rp329.000.000 | Rp987.000.000 |
| Gross Profit | Rp39.480.000 | Rp118.440.000 |
| Net Contribution | Rp34.480.000 | Rp113.440.000 |
| CPP | Rp500.000 | Rp166.667 |
| Break-even CPP | Rp3.948.000 | Rp3.948.000 |
| **ROI** | **690%** | **2.269%** |

Dua kesimpulan yang harus muncul di dashboard:
1. Campaign B lebih mahal per lead tapi 3x lebih murah per closing, dan ROI-nya 3,3x lipat Campaign A
2. Kedua campaign masih jauh di bawah break-even CPP Rp3.948.000, artinya keduanya layak dinaikkan budgetnya. Yang perlu dijaga adalah CPP tidak menembus angka itu saat spend naik

---

## 12. CS Performance

Metrik per CS: Total Lead, distribusi bucket, metrik funnel kumulatif, Closing, Gross Booking Value, Gross Profit, Average Closing Value, Profit per Closing, Average dan Median Closing Interval, Cancellation Rate.

CS yang menjual paket mahal bisa kalah kontribusi dari CS yang menjual banyak paket margin tebal. Urutkan default berdasarkan Gross Profit, bukan Gross Booking Value.

Tambahan: Report Compliance (berapa hari kerja bulan ini CS mengirim laporan).

---

## 13. Management Report

Filter: bulan atau rentang tanggal, CS, source, campaign, program, mode attribution.

Output: Acquisition (spend, leads, CPL), Lead Quality, Sales, Profitability (gross profit, margin, net contribution, ROI, break-even CPP), Lead Insight, CS Performance.

### Period Lock

```
period_locks (brand_id, year, month, locked_at, locked_by, unlock_reason)
```

**Yang dikunci:** perubahan manual oleh user pada `lead_reports`, `lead_report_insights`, dan `closings` yang tanggalnya jatuh di periode terkunci.

**Yang tidak dikunci:** koreksi otomatis oleh trigger T-1. Closing tanggal 10 September untuk lead tanggal 20 Agustus tetap harus bisa mengoreksi bucket laporan Agustus, walaupun Agustus sudah terkunci. Kalau ini ikut diblokir, invarian `sum = total_lead` pecah dan closing jadi orphan.

Implementasi: trigger period lock memeriksa flag sesi `app.system_correction`. Trigger T-1 menyalakan flag itu sebelum menulis dan mematikannya setelah selesai. Setiap koreksi lintas periode terkunci dicatat ke audit log dengan action `cross_period_correction` supaya Owner tahu laporan bulan lalu berubah.

**Auto-lock:** D+45 setelah akhir bulan, bukan D+7. Alasannya median closing interval umroh berada di kisaran belasan hari dengan ekor panjang, jadi D+7 akan mengunci periode yang closing-nya masih berdatangan. Angka final ditetapkan setelah median interval aktual dihitung dari data historis.

Owner bisa mengunci lebih awal secara manual, dan bisa membuka dengan alasan tertulis. Semua masuk audit log.

Dashboard management report menampilkan penanda pada periode yang angkanya berubah setelah laporan diterbitkan.

---

## 14. Export

### 14.1 Operational CSV
Filter: rentang tanggal, CS, program, source, campaign, status.

Kolom: date, cs, source, campaign, total_lead, cold, consultation, offering, closing, dan untuk baris closing: customer_name, whatsapp, lead_date, closing_date, interval_days, province, city, program, departure_date, room_type, pax, price, total_value, payment_status, paid_amount.

### 14.2 Meta Ads / LTV Export
- Sumber: tabel `closings`, hanya baris dengan `pdp_consent = true` dan `payment_status <> 'cancelled'`
- Normalisasi: lowercase, trim, telepon ke E.164 tanpa tanda plus, nama tanpa gelar
- Hashing SHA-256 dilakukan di layer formatter, bukan di database
- Formatter terpisah dari schema agar perubahan format Meta tidak menyentuh DB
- Setiap export tercatat di `export_logs`: siapa, kapan, filter apa, berapa baris

Verifikasi field list Meta terbaru sebelum sprint ini jalan.

---

## 15. Ads data

MVP menerima input manual atau import CSV ke `ad_performance`. Struktur tabel sudah menyiapkan bentuk yang sama dengan output Meta Insights API sehingga Phase 2 tinggal mengganti sumbernya.

```
ad_accounts   (id, brand_id, external_id, name, status)
ad_campaigns  (id, ad_account_id, external_id, name, objective, status)
ad_sets       (id, ad_campaign_id, external_id, name, status)
ads           (id, ad_set_id, external_id, name, status)
ad_performance(id, brand_id, level, entity_id, date,
               spend, impressions, reach, clicks, ctr, cpc, cpm, leads)
```

`level` enum: `account` / `campaign` / `adset` / `ad`. Unik per (level, entity_id, date).

---

## 16. Database (ringkas)

```
brands
users                    (auth provider + role + brand_id)
regions                  (province, city, seed Kemendagri)
lead_sources
insight_categories
programs
program_departures
program_prices
program_costs
brand_settings
lead_reports
lead_report_insights
closings
ad_accounts / ad_campaigns / ad_sets / ads / ad_performance
period_locks
export_logs
sync_logs
audit_logs
```

Semua tabel operasional membawa `brand_id`. Row level security aktif berdasarkan `brand_id`, `user_id`, dan `role`.

---

## 17. Audit Log

Mencatat insert, update, delete pada `lead_reports`, `lead_report_insights`, `closings`, `program_prices`, `period_locks`, dan perubahan role user.

Isi: user, action, table, record_id, old_value (jsonb), new_value (jsonb), timestamp, ip.

Diimplementasikan sebagai trigger database supaya tidak bisa dilewati lewat jalur lain.

---

## 18. PWA

Responsive, mobile first, installable, persistent login lewat session cookie httpOnly dengan auto refresh. Form tahan koneksi buruk lewat idempotency key dan retry. Offline penuh bukan syarat MVP, tapi antrian submit lokal boleh disiapkan.

---

## 19. Scope MVP

**Masuk:** login, dua role, HPP dan gross profit, ROI dan break-even CPP, Labbaika Group, laporan harian multi-source, bucket stage, closing auto-derived, lead insight, program + departure + price, closing tracker dengan payment status, revenue dua versi, dua mode attribution, dashboard Owner lima layer, CS performance, management report, period lock, ads data manual/import, operational CSV, Meta LTV export dengan consent, PWA, audit log, database multi-brand ready.

**Keluar:** AI lead scoring, AI baca chat, WhatsApp API, follow-up otomatis, individual tracking semua lead, Meta API otomatis, Google Ads API, predictive LTV, commission, accounting, payment gateway.

---

## 20. Definition of Done

- [ ] CS dan Owner bisa login, session bertahan di HP
- [ ] CS membuat laporan harian multi-source dalam 2 menit
- [ ] Validasi `cold + consultation + offering = total_lead - closing_auto` jalan
- [ ] Submit dua kali tidak menghasilkan baris ganda
- [ ] CS input closing, laporan tanggal lead ikut terkoreksi otomatis
- [ ] Closing tanpa laporan yang cocok muncul di panel Unlinked
- [ ] Duplikat WhatsApp terdeteksi dan meminta konfirmasi
- [ ] Harga prefill dari price yang berlaku di closing_date, override berfungsi
- [ ] Harga master berubah, transaksi lama tidak berubah
- [ ] Dashboard menampilkan bucket dan funnel kumulatif dengan label berbeda
- [ ] Toggle attribution mengubah angka ROI sesuai definisi
- [ ] HPP tersimpan terkunci saat closing, perubahan HPP master tidak mengubah profit transaksi lama
- [ ] CS tidak bisa membaca HPP dan margin lewat API maupun query langsung
- [ ] Angka ROI yang memakai perkiraan margin diberi tanda estimasi
- [ ] Break-even CPP tampil berdampingan dengan CPP aktual
- [ ] Gross dan Collected revenue tampil berdampingan, cancelled dikeluarkan
- [ ] Management report bisa difilter dan diekspor
- [ ] Period lock mencegah edit CS
- [ ] Operational CSV dan Meta LTV CSV bisa diunduh, export tercatat
- [ ] RLS memblokir CS mengakses data CS lain (diuji, bukan diasumsikan)
- [ ] Audit log merekam perubahan nilai lama dan baru
- [ ] Semua tanggal konsisten Asia/Jakarta
- [ ] Closing lintas periode terkunci tetap mengoreksi laporan bulan sebelumnya, dan tercatat sebagai cross_period_correction
- [ ] Dashboard menampilkan campaign_attribution_rate dan memperingatkan saat di bawah 60%
- [ ] CS bisa mengoreksi laporan H-7 dari beranda
- [ ] Metrik funnel selain closing_rate diberi label estimasi di UI

---

## 21. Roadmap sesudah MVP

**Phase 2:** Meta Ads API otomatis lewat Hermes sebagai orchestrator, individual lead tracking, conversation status.
**Phase 3:** lead score 0-100, klasifikasi objection otomatis, prediksi kualitas lead.
**Phase 4:** multi brand (Alaika dan berikutnya) dengan isolasi data per brand.
