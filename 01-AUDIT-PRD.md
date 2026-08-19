# Audit PRD Labbaika Group Reporting Platform

Basis: PRD MVP v1.0
Tanggal audit: 19 Agustus 2026
Metode: pembacaan konsistensi antar-section, pengujian invarian data, simulasi kasus nyata travel umroh.

Severity:
- **P0** = bikin angka dashboard salah atau data korup. Wajib selesai sebelum coding.
- **P1** = bikin ulang kerja / migrasi data kalau baru ketahuan nanti.
- **P2** = rapikan sebelum rilis, tidak menghambat arsitektur.

---

## P0-01. Stage bucket vs funnel: dua definisi yang bertabrakan

**Lokasi:** §7, §18, §19, §20, §31

**Masalah:**
Validasi §31 bilang `Cold + Consultation + Offering + Closing = Total Lead`. Artinya stage adalah bucket eksklusif (satu lead cuma masuk satu kolom). Tapi §18 menggambarkannya sebagai funnel bertingkat, dan §20 menghitung `Lead → Consultation %`, `Consultation → Offering %`, `Offering → Closing %`.

Kalau bucket eksklusif, maka `Closing / Offering` bukan conversion rate. Contoh §19 Campaign B: Offering 70, Closing 30. Dibaca sebagai conversion "Offering ke Closing = 43%", padahal 70 itu lead yang **mentok** di Offering dan tidak closing. Conversion aslinya = 30 / (70+30) = 30%.

Angka ini yang dipakai untuk memutuskan scale/kill campaign. Salah baca = salah keputusan budget.

**Fix:**
Pisahkan dua konsep secara eksplisit di schema dan di UI.

1. **Stage tersimpan = furthest stage reached** (terminal stage per lead). Ini yang diinput CS, tetap eksklusif, validasi jumlah tetap berlaku.
2. **Metrik funnel diturunkan (derived), bukan diinput:**

```
reached_lead          = total_lead
reached_consultation  = consultation + offering + closing
reached_offering      = offering + closing
reached_closing       = closing

rate_lead_to_consult  = reached_consultation / reached_lead
rate_consult_to_offer = reached_offering / reached_consultation
rate_offer_to_closing = reached_closing / reached_offering
closing_rate_overall  = closing / total_lead
```

3. Kolom mentah (cold/consultation/offering/closing) tetap ditampilkan sebagai **distribusi**, dengan label "lead berhenti di stage ini". Jangan pernah dipakai langsung sebagai conversion rate.

---

## P0-02. Lead pindah stage lintas hari tidak punya mekanisme apapun

**Lokasi:** §8, §13, §14

**Masalah:**
Lead masuk 19 Agustus, dicatat Offering. Closing 23 Agustus. Interval 4 hari (§14 mengakui ini normal).

Pertanyaan yang tidak dijawab PRD: laporan tanggal 19 Agustus itu diupdate atau tidak?

- Kalau **tidak** diupdate: kolom Closing di lead_reports selamanya lebih kecil dari jumlah baris di Closing Tracker. Dua angka closing yang berbeda di satu aplikasi.
- Kalau CS **update manual**: invarian `sum = total_lead` gampang pecah, dan tidak ada trigger yang mengingatkan.
- Kalau CS malah bikin laporan baru tanggal 23 dengan Closing 1: total lead ikut kehitung dua kali.

Ini bug paling mematikan karena diam-diam. Tidak ada error, cuma angka yang salah pelan-pelan.

**Fix: closing bucket jadi derived, bukan input.**

1. Tabel `closings` punya `lead_report_id` (FK, nullable) dan `previous_stage` (enum: cold / consultation / offering).
2. Saat CS input closing, sistem cari lead_report yang match: brand + cs + lead_date + source. Kalau ketemu, tampilkan konfirmasi: "Sebelum closing, lead ini ada di stage mana pada 19 Agu? [Offering]".
3. Trigger DB: `closing +1`, `previous_stage -1` pada report tanggal itu. `total_lead` tidak berubah. Invarian aman otomatis.
4. Kalau report tidak ketemu, closing tetap disimpan dengan `lead_report_id = NULL` dan masuk daftar **Unlinked Closings** di dashboard Owner untuk direkonsiliasi.
5. Form harian CS: kolom Closing jadi read-only (auto). CS hanya isi Total Lead, Cold, Consultation, Offering. Validasi jadi:
   `cold + consultation + offering = total_lead - closing_auto`

Efek samping bagus: CS berkurang satu field, target 1-2 menit lebih gampang tercapai.

---

## P0-03. ROAS dan CPP tidak punya definisi attribution window

**Lokasi:** §17C, §21

**Masalah:**
Spend terjadi di tanggal iklan tayang. Revenue terjadi di tanggal closing. Jarak keduanya 4 sampai 30+ hari untuk umroh.

Kalau ROAS bulanan dihitung `revenue(Agustus) / spend(Agustus)`, yang dibandingkan adalah dua cohort berbeda. Bulan yang spend-nya naik tajam akan terlihat ROAS jelek padahal closing-nya baru masuk bulan depan.

**Fix:** dashboard wajib punya toggle mode attribution, defaultnya eksplisit di UI.

| Mode | Revenue diakui pada | Dipakai untuk |
|---|---|---|
| **Cash basis** (default tampilan Sales) | `closing_date` | laporan bulanan management, cashflow |
| **Cohort / lead basis** | `lead_date` dari closing tersebut | menilai kualitas campaign, ROAS keputusan budget |

Tampilkan juga `median_closing_interval` dan peringatan maturity: "Cohort Agustus baru matang 60%, median closing interval 12 hari."

---

## P0-04. Revenue diakui penuh di titik closing, tanpa status pembayaran

**Lokasi:** §14, §17C, §36

**Masalah:**
PRD mengeluarkan accounting dari scope, wajar. Tapi `Total Value = Price × Pax` diakui 100% saat closing dicatat. Realita umroh: closing sering artinya DP 5 juta, pelunasan H-30, dan pembatalan bukan hal langka.

Akibat: Revenue dan ROAS di dashboard bisa overstate signifikan. Owner ambil keputusan scale budget dari angka yang belum tentu masuk.

**Fix minimal (bukan accounting penuh):**
Tambah di tabel `closings`:
- `payment_status` enum: `dp` / `partial` / `lunas` / `cancelled` / `refunded`
- `paid_amount` bigint, default 0
- `cancelled_at`, `cancel_reason`

Dashboard tampilkan dua angka berdampingan:
- **Gross Booking Value** = total_value semua closing non-cancelled
- **Collected Revenue** = sum(paid_amount)

ROAS default pakai Gross, dengan Collected sebagai pembanding. Cancelled dikeluarkan dari kedua-duanya dan ditampilkan sebagai `cancellation_rate`.

---

## P0-05. Timezone tidak didefinisikan

**Lokasi:** seluruh dokumen

**Masalah:**
"Laporan hari ini", closing date, interval, grouping bulanan. Kalau server UTC dan CS input jam 08:00 WIB, tanggalnya masih hari sebelumnya di UTC. Laporan tanggal 19 masuk ke bucket 18.

**Fix:**
- Semua kolom tanggal bisnis pakai tipe `DATE`, bukan `timestamp`. Tidak ada konversi zona.
- Semua timestamp audit pakai `timestamptz`.
- Aplikasi mengunci `Asia/Jakarta` untuk menentukan "hari ini" di sisi client dan untuk semua agregasi di query.
- Tulis konstanta `APP_TIMEZONE = 'Asia/Jakarta'` di satu tempat.

---

## P1-06. Program dan keberangkatan dicampur jadi satu entitas

**Lokasi:** §15, §16

**Masalah:**
§16 menaruh `Departure Date` sebagai field di tabel Program. Padahal "Turki 16D" punya banyak tanggal keberangkatan dengan harga berbeda. Price history versi §15 pakai `effective_date`, yang menjawab "harga berubah kapan", bukan "harga untuk keberangkatan mana".

Kalau Turki 16D Oktober 32,9 juta dan Turki 16D Desember 36,9 juta dijual di minggu yang sama, model §15 tidak bisa merepresentasikannya.

**Fix:**
```
programs            (id, brand_id, name, destination, duration_days, status)
program_departures  (id, program_id, departure_date, return_date, status, quota)
program_prices      (id, program_id, departure_id NULL, room_type, price,
                     effective_date, end_date NULL, status)
```
Closing menyimpan `departure_id` selain `program_id`. Kalau travel benar-benar tidak butuh granularitas ini, `departure_id` boleh NULL, tapi kolomnya ada sejak awal supaya tidak perlu migrasi.

---

## P1-07. Satu harga per closing tidak muat untuk kamar quad/triple/double

**Lokasi:** §14, §30

**Masalah:**
`Total = Price × Pax` mengasumsikan semua pax bayar sama. Satu keluarga 4 orang sering pesan 2 double, atau 3 dewasa quad + 1 anak. Harga per room type berbeda 3 sampai 8 juta.

**Fix MVP (tanpa bikin form rumit):**
- `program_prices.room_type` enum: `quad` / `triple` / `double` / `child` / `infant`
- Di form closing, default: pilih 1 room type, `total_value` auto = price × pax
- Sediakan toggle "harga khusus": CS isi `total_value` manual, wajib isi `price_note`, sistem set `is_price_override = true`
- Dashboard bisa melaporkan berapa persen transaksi pakai override. Kalau tinggi, berarti butuh line item di Phase 2.

---

## P1-08. Tidak ada unique constraint pada lead_reports

**Lokasi:** §27, §31

**Masalah:**
CS klik Simpan dua kali karena sinyal lemah (§34 mengakui koneksi tidak stabil). Dua baris identik masuk. Total lead di dashboard dobel.

**Fix:**
```sql
UNIQUE (brand_id, cs_id, report_date, source_id, COALESCE(campaign_id, '00000000-...'::uuid))
```
Postgres memperlakukan NULL sebagai tidak sama, jadi campaign_id NULL harus di-COALESCE ke sentinel UUID atau pakai generated column. Tambahkan juga idempotency key dari client untuk retry aman.

---

## P1-09. Satu laporan harian hanya menampung satu source

**Lokasi:** §8 vs §29

**Masalah:**
§8 menaruh Source di level laporan. §29 menggambarkan UI sebagai satu form "Laporan Hari Ini". CS yang menerima lead dari Facebook CTWA dan Organic di hari yang sama harus mengisi form dua kali, atau (lebih mungkin) menggabungkannya jadi satu dan memilih source asal. Data source jadi sampah, padahal §17D butuh "Lead Quality per Source".

**Fix:**
UI satu halaman, isi multi-baris. Satu halaman laporan berisi N blok source. Simpan sekali, sistem membuat N baris `lead_reports`. Total Lead per hari ditampilkan sebagai jumlah semua blok, sebagai kontrol visual buat CS.

---

## P1-10. Duplikasi closing antar CS tidak dicegah

**Lokasi:** §13, §31

**Masalah:**
Satu calon jamaah chat ke dua CS. Dua-duanya input closing. Revenue dobel, pax dobel, dan data LTV yang dikirim ke Meta jadi kotor.

**Fix:**
- Normalisasi nomor WhatsApp ke E.164 (`+628...`) sebelum disimpan, di kolom `whatsapp_e164`
- Index unik parsial: `UNIQUE (brand_id, whatsapp_e164, departure_id) WHERE payment_status <> 'cancelled'`
- Kalau melanggar, jangan hard-block. Tampilkan peringatan: "Nomor ini sudah dicatat closing oleh CS Reza pada 21 Agu, program Turki 16D Okt. Lanjutkan?" lalu butuh konfirmasi Owner untuk simpan. Kasus rombongan besar memang bisa punya PIC yang sama.

---

## P1-11. Export ke Meta belum menyebut hashing dan consent

**Lokasi:** §23

**Masalah:**
PRD menyerahkan format ke waktu integrasi. Yang tidak boleh ditunda adalah dua hal:

1. Meta Customer List mensyaratkan data identitas dinormalisasi lalu di-hash SHA-256 sebelum diupload. Kalau kolom sumbernya tidak menyimpan bentuk normal, hashing menghasilkan match rate rendah. *[Medium confidence: mekanisme hashing SHA-256 untuk customer list sudah lama jadi standar Meta, tapi field list dan aturan terbaru wajib dicek di dokumentasi Meta saat implementasi.]*
2. Mengirim data pribadi jamaah ke pihak ketiga menyentuh UU PDP No. 27/2022. Butuh dasar pemrosesan yang sah. *[Low-Medium confidence soal detail kewajiban teknisnya. Perlu verifikasi ke konsultan hukum sebelum export pertama jalan.]*

**Fix:**
- Simpan `whatsapp_e164`, dan tambah field opsional `email`, `first_name`, `last_name` terpisah (bukan satu kolom `customer_name`). Match rate Meta naik signifikan dengan email.
- Tambah `pdp_consent` boolean + `pdp_consent_at` di closing. Default false. Export LTV hanya menyertakan baris dengan consent true.
- Formatter export terpisah dari DB (PRD sudah benar di poin ini), hashing dilakukan di formatter.
- Siapkan kalimat consent singkat yang dibacakan CS saat closing.

---

## P1-12. Field "CS" bisa diisi bebas di form closing dan lead report

**Lokasi:** §8, §13

**Masalah:**
CS sedang login, identitasnya sudah diketahui sistem. Membiarkan field CS diisi manual membuka salah atribusi, sengaja maupun tidak, dan merusak §20 CS Performance.

**Fix:**
`cs_id` selalu = user yang login untuk role CS, field tidak ditampilkan. Hanya role Owner yang melihat dropdown CS (untuk input susulan atau koreksi), dan setiap perubahan `cs_id` masuk audit log.

---

## P2-13. Lead Insight tidak punya aturan jumlah

**Lokasi:** §11

**Masalah:**
Contoh di PRD menautkan insight ke stage Offering ("Offering 10 leads, total insight 10"), tapi struktur formnya tidak menyebut stage. Tanpa aturan, CS bisa memasukkan 40 insight untuk 7 lead Offering.

**Fix:**
- `lead_report_insights (id, lead_report_id, stage, category_id, lead_count, note)`
- Constraint per (report, stage): `sum(lead_count) <= stage_count`
- Insight tetap opsional. Kalau CS isi sebagian, sisanya dianggap "tidak dilaporkan", bukan nol.
- Di §12 persentase Top Reason harus dihitung dari total insight terisi, bukan total lead. Beri label denominatornya di dashboard.

---

## P2-14. Price history bisa bolong dan bisa tumpang tindih

**Lokasi:** §15

**Masalah:**
Dua baris harga dengan `effective_date` dan `end_date` yang overlap membuat lookup harga ambigu. Gap membuat lookup mengembalikan kosong dan form closing gagal prefill.

**Fix:**
- Constraint exclusion Postgres (`btree_gist`) untuk mencegah overlap per (program_id, departure_id, room_type)
- `end_date` NULL berarti terbuka
- Aturan prefill: harga yang diambil adalah yang berlaku pada `closing_date`, bukan `lead_date`. Nilai ini disalin ke `price_at_transaction` dan tidak pernah dibaca ulang dari master.
- Kalau lookup kosong, form tetap bisa lanjut dengan input harga manual + flag override.

---

## P2-15. Angka rupiah rawan floating point

**Lokasi:** §14

**Fix:** simpan sebagai `bigint` dalam satuan rupiah penuh, tidak ada desimal, tidak ada `float`/`double`. Formatting ke "Rp32.900.000" hanya di layer presentasi.

---

## P2-16. Interval closing belum didefinisikan untuk kasus hari yang sama

**Lokasi:** §14

**Fix:** `interval_days = closing_date - lead_date`, closing hari yang sama = 0 hari. Tulis di tooltip dashboard supaya tidak ada dua tafsir.

---

## P2-17. Tidak ada period lock

**Lokasi:** §33

**Masalah:**
Management report Agustus sudah dikirim ke Owner. Minggu depan CS mengedit laporan 12 Agustus. Angka berubah, laporan yang sudah beredar jadi salah, tidak ada yang tahu.

**Fix:**
- `period_locks (brand_id, year, month, locked_at, locked_by)`
- Setelah terkunci, CS tidak bisa edit. Owner bisa membuka dengan alasan tertulis, tercatat di audit log.
- Aturan longgar untuk MVP: auto-lock D+7 setelah akhir bulan.

---

## P2-18. CPL punya dua sumber angka lead

**Lokasi:** §17A

**Masalah:**
Lead versi Meta (form/CTWA) dan lead versi hitungan CS hampir tidak pernah sama. Chat masuk tanpa isi form, lead form yang tidak pernah chat, spam. Kalau dashboard menampilkan satu angka "CPL" tanpa label, akan ada perdebatan panjang di tim.

**Fix:** tampilkan keduanya, beri nama berbeda: `CPL (Meta)` dan `CPL (CS-reported)`, plus `lead_capture_gap %`. Selisih itu sendiri adalah insight operasional yang berguna.

---

## P2-19. Master wilayah Indonesia belum punya sumber

**Lokasi:** §13

**Fix:** seed statis provinsi dan kabupaten/kota dari data Kemendagri, disimpan di tabel `regions` (bukan hardcode di FE). Alamat lengkap jadikan opsional, PDP-nya lebih ringan kalau tidak dikumpulkan tanpa keperluan.

---

## P2-20. Persistent login pada PWA

**Lokasi:** §34

**Fix:** pakai session cookie httpOnly milik provider auth (Supabase Auth) dengan auto refresh, bukan menyimpan token di localStorage. Tambah PIN atau biometrik opsional untuk unlock cepat di HP CS.

---

## Ringkasan dampak

| ID | Severity | Tanpa fix, gejalanya |
|---|---|---|
| P0-01 | P0 | Conversion rate salah, campaign bagus di-kill |
| P0-02 | P0 | Dua angka closing yang tidak pernah cocok |
| P0-03 | P0 | ROAS bulanan menyesatkan saat spend naik |
| P0-04 | P0 | Revenue overstate, cancel tidak terlihat |
| P0-05 | P0 | Laporan pagi masuk tanggal kemarin |
| P1-06 | P1 | Harga per keberangkatan tidak bisa dimodelkan |
| P1-07 | P1 | Total value salah untuk booking campuran |
| P1-08 | P1 | Laporan dobel saat sinyal jelek |
| P1-09 | P1 | Data source tidak bisa dipercaya |
| P1-10 | P1 | Revenue dobel, data LTV kotor |
| P1-11 | P1 | Export Meta match rate rendah, risiko PDP |
| P1-12 | P1 | Atribusi CS bisa dimanipulasi |
| P2-13 | P2 | Persentase objection tidak bisa dibaca |
| P2-14 | P2 | Prefill harga gagal atau ambigu |
| P2-15 | P2 | Selisih rupiah di total |
| P2-16 | P2 | Interval beda tafsir |
| P2-17 | P2 | Laporan management berubah setelah terbit |
| P2-18 | P2 | Debat CPL tanpa ujung |
| P2-19 | P2 | Dropdown wilayah tidak konsisten |
| P2-20 | P2 | CS logout terus, adopsi turun |

---

## Temuan putaran kedua (setelah v1.1)

Tiga hal berikut ditemukan saat menguji fix v1.1 terhadap satu sama lain. Dua di antaranya lolos dari audit pertama, satu muncul justru karena fix yang saya buat sendiri bertabrakan.

### P0-21. Period lock memblokir koreksi closing lintas bulan

**Konflik antara:** fix P0-02 (trigger koreksi laporan) dan fix P2-17 (period lock).

Closing 10 September untuk lead 20 Agustus. Trigger T-1 ingin mengurangi bucket Offering di laporan 20 Agustus. Tapi auto-lock D+7 sudah mengunci Agustus pada 7 September. Trigger ditolak, transaksi gagal, closing tidak bisa disimpan. Kalau triggernya dibuat diam-diam gagal, invarian `sum = total_lead` pecah.

**Fix:** period lock hanya memblokir perubahan manual user. Trigger sistem dikecualikan lewat flag sesi, dan setiap koreksi lintas periode dicatat sebagai `cross_period_correction`. Auto-lock digeser ke D+45 mengikuti realitas interval closing umroh. Ditulis di PRD v1.2 §13.

### P0-22. CS tidak punya cara tahu lead datang dari campaign mana

**Lokasi:** §10 dan §19 PRD v1.0, dan tetap ada di v1.1 §5.

Seluruh nilai jual "bandingkan kualitas campaign" bergantung pada kolom `campaign_id` di laporan harian. Yang mengisi kolom itu CS. CS menerima chat WhatsApp tanpa penanda apapun. Dia akan menebak, atau memilih campaign yang paling sering dipakai.

Hasilnya dashboard Campaign Quality terlihat penuh angka tapi isinya tebakan. Ini lebih berbahaya daripada dashboard kosong, karena keputusan budget diambil dari situ.

**Fix:** campaign hanya diisi kalau ada penanda yang terlihat CS, yaitu `ref` parameter CTWA, `utm_campaign` dari landing page, atau nomor WhatsApp terpisah. Tanpa penanda, kosongkan. Sistem menghitung `campaign_attribution_rate` dan memperingatkan kalau di bawah 60%. Ditulis di PRD v1.2 §5.4.

Catatan operasional: pemasangan `ref` per campaign adalah pekerjaan advertiser dan harus selesai sebelum MVP dipakai untuk keputusan budget. Tanpa itu, MVP hanya akurat sampai level source.

### P1-23. Perpindahan stage non-closing tetap tidak tercatat

Fix P0-02 hanya menyelesaikan lead yang closing. Lead yang naik dari Cold ke Consultation di hari berikutnya tidak mengoreksi laporan hari sebelumnya, karena tanpa identitas lead sistem tidak tahu lead mana yang naik.

Efeknya `reached_consultation` dan `reached_offering` understate, sementara `closing` akurat. Angka funnel tengah jadi tidak setara akurasinya dengan angka ujung.

**Fix:** terima sebagai keterbatasan model aggregate, jangan tambal dengan field baru. Tiga langkah: CS boleh mengoreksi laporan sampai H-7 lewat tombol di beranda, metrik funnel tengah diberi label estimasi di UI, dan `closing_rate` overall dijadikan metrik utama untuk keputusan. Ditulis di PRD v1.2 §3.4.

Akurasi penuh seluruh tahap funnel baru mungkin di Phase 2 dengan individual lead tracking.

### Status akhir

| Kelompok | Jumlah | Status |
|---|---|---|
| Temuan putaran pertama | 20 | tertutup di PRD v1.2 |
| Temuan putaran kedua | 3 | tertutup di PRD v1.2 |
| Butuh verifikasi eksternal | 4 | terbuka, lihat bagian di bawah |

Empat item verifikasi tidak memblokir mulainya coding, tapi memblokir rilis fitur terkait. Kolom `pdp_consent` dan pipeline hashing tetap dibangun sesuai spesifikasi, hanya tombol export Meta yang ditahan sampai verifikasi selesai.

---

## Yang perlu diverifikasi sebelum eksekusi

1. Format dan field Customer List Meta Ads terbaru (cek dokumentasi resmi Meta saat sprint export).
2. Kewajiban UU PDP untuk pengiriman data jamaah ke platform iklan (konsultan hukum).
3. Apakah Labbaika benar-benar butuh granularitas room type di MVP, atau mayoritas transaksi memang satu harga per pax. Cek 100 baris terakhir Closing Tracker di spreadsheet.
4. Median closing interval aktual dari data historis. Angka ini menentukan default attribution window.
