# Task List: Claude Code (Sonnet) — Major

Kriteria masuk daftar ini: butuh penalaran lintas file, menyentuh keamanan data, mengubah schema, menulis SQL agregat, atau mengelola state kompleks. Kalau sebuah task bisa dikerjakan tanpa membaca file lain, pindahkan ke daftar DeepSeek.

Konvensi:
- Satu task = satu branch = satu PR
- Branch: `cc/<id>-<slug>`
- Setiap PR wajib lulus `pnpm typecheck`, `pnpm lint`, `pnpm test`
- Task yang menyentuh SQL wajib menyertakan file migrasi bernomor dan skrip rollback

Legenda: **[dep]** = prasyarat.

---

## Bagian A — Fondasi

### CC-B01 Bootstrap repo
Next.js 15 App Router, TypeScript strict, Tailwind, Supabase client (server dan browser), struktur folder `app/ lib/ db/ supabase/migrations/ tests/`. Setup env, `.env.example`, GitHub Actions untuk typecheck + lint + test.
**Selesai kalau:** `pnpm dev` jalan, koneksi Supabase terverifikasi lewat satu query sehat, CI hijau.

### CC-B02 Migrasi 001: enum dan master [dep: B01]
Buat semua enum (`user_role`, `lead_stage`, `room_type`, `payment_status`, `ad_level`, `region_level`), lalu tabel `brands`, `app_users`, `regions`, `lead_sources`, `insight_categories`. Aktifkan extension `btree_gist` dan `pgcrypto`.
**Selesai kalau:** migrasi naik dan turun bersih dua kali berturut-turut.

### CC-B03 Migrasi 002: program, departure, price, cost, brand settings [dep: B02]
Lima tabel sesuai `04-BRIEF-BE.md` §2.2, termasuk constraint exclusion anti-overlap pada `program_prices` dan `program_costs`.

`program_costs` dan `brand_settings` adalah tabel sensitif. Sejak migrasi pertama, jangan berikan grant apapun ke role CS.
**Selesai kalau:** menyisipkan dua harga yang periodenya bertumpuk untuk kombinasi program+departure+room_type yang sama ditolak database. Sertakan test SQL yang membuktikannya.

### CC-B04 Migrasi 003: lead_reports dan insights [dep: B02]
Termasuk generated column `campaign_key`, CHECK jumlah stage, unique index, dan unique index idempotency.
**Selesai kalau:** insert dua kali dengan `idempotency_key` sama menghasilkan satu baris. Insert dengan `cold+consultation+offering+closing <> total_lead` ditolak.

### CC-B05 Migrasi 004: closings [dep: B03, B04]
Seluruh kolom sesuai brief, generated column `interval_days`, unique index dedup parsial, semua CHECK.
**Selesai kalau:** `closing_date < lead_date` ditolak, `pax = 0` ditolak, `paid_amount > total_value` ditolak.

### CC-B06 Migrasi 005: tabel ads [dep: B02]
`ad_accounts`, `ad_campaigns`, `ad_sets`, `ads`, `ad_performance` dengan unique per (brand, level, entity, date).

### CC-B07 Migrasi 006: tabel sistem [dep: B02]
`period_locks`, `export_logs`, `sync_logs`, `audit_logs`.

---

## Bagian B — Trigger, inti kebenaran data

### CC-B08 Trigger normalisasi WhatsApp dan resolusi link [dep: B05]
Fungsi `normalize_wa_id(text)` yang mengubah `0812...`, `62812...`, `+62 812-...` menjadi `+62812...`, dan menolak yang tidak cocok pola. Trigger BEFORE INSERT/UPDATE pada `closings`. Trigger kedua mengisi `lead_report_id` dari pencarian brand + cs + lead_date + source.
**Selesai kalau:** tabel test berisi minimal 12 varian format nomor menghasilkan output yang benar, dan 4 input tidak valid ditolak.

### CC-B08b Trigger penguncian HPP saat closing [dep: B03, B05]
Implementasi T-7. Tiga cabang: HPP aktual, perkiraan dari `default_margin_pct`, dan tidak diketahui.
**Selesai kalau:** empat skenario lulus.
1. HPP terisi, `cost_source = 'actual'`, `gross_profit` benar
2. HPP kosong tapi `default_margin_pct` 12, `cost_source = 'estimated'`, `cost_at_transaction` = 88% harga jual
3. Dua-duanya kosong, closing tetap tersimpan, `cost_source = 'unknown'`, `gross_profit` sama dengan `total_value`
4. Ubah HPP master setelah closing tersimpan, `gross_profit` transaksi lama tidak berubah

### CC-B09 Trigger sinkronisasi closing ke lead report [dep: B08]
Ini task paling kritis di seluruh proyek. Implementasi penuh T-1 pada `04-BRIEF-BE.md` §3: insert, delete, cancel, uncancel, pindah `lead_report_id`, pindah `previous_stage`.
**Selesai kalau:** test skenario berikut semuanya lulus.
1. Report 19 Agu: total 50, cold 25, cons 15, offering 10, closing 0. Insert closing lead_date 19 Agu previous_stage offering. Hasil: offering 9, closing 1, total tetap 50.
2. Closing tadi di-cancel. Hasil kembali ke offering 10, closing 0.
3. Insert closing saat offering bernilai 0. Transaksi gagal dengan pesan `STAGE_UNDERFLOW`.
4. Update `previous_stage` dari offering ke consultation. Hasil: offering kembali +1, consultation -1.
5. Update `lead_date` sehingga pindah ke report lain. Report lama pulih, report baru terkoreksi.
6. Insert closing tanpa report yang cocok. `lead_report_id` NULL, tidak ada report yang berubah.
7. Invarian `cold+consultation+offering+closing = total_lead` bertahan di semua skenario di atas.

### CC-B10 Trigger validasi insight [dep: B04]
`sum(lead_count)` per (report, stage) tidak boleh melebihi jumlah lead pada stage itu. Termasuk kasus laporan diedit turun setelah insight terisi: trigger pada `lead_reports` juga harus memeriksa ulang.

### CC-B11 Trigger period lock [dep: B07, B09]
Menolak tulis pada `lead_reports`, `lead_report_insights`, `closings` untuk periode terkunci, kecuali pemanggilnya owner.

Termasuk pengecualian flag sesi `app.system_correction` untuk trigger T-1, dan pencatatan `cross_period_correction` ke audit log.
**Selesai kalau:** empat skenario ini lulus.
1. CS gagal edit laporan Agustus setelah Agustus dikunci
2. Owner berhasil edit, tercatat di audit log
3. Closing tanggal 10 Sep dengan lead_date 20 Agu **berhasil disimpan** walaupun Agustus terkunci, dan bucket laporan 20 Agu ikut terkoreksi
4. Koreksi pada skenario 3 muncul di audit log sebagai `cross_period_correction`

Skenario 3 adalah alasan task ini bergantung pada B09. Jangan kerjakan terpisah.

### CC-B12 Trigger audit log generik [dep: B07]
Satu fungsi trigger yang dipasang ke enam tabel. Menyimpan `old_value` dan `new_value` sebagai jsonb, plus `auth.uid()`.

---

## Bagian C — Keamanan

### CC-B13 Policy RLS seluruh tabel [dep: B02..B07]
Sesuai matriks `04-BRIEF-BE.md` §4. Aktifkan `FORCE ROW LEVEL SECURITY`.

### CC-B14 Test suite RLS [dep: B13]
Uji dengan sesi user asli, bukan service role.
**Selesai kalau:** setiap kasus di bawah punya assertion terpisah dan lulus.
- CS A tidak bisa membaca satupun baris closing milik CS B
- CS tidak bisa membaca `ad_performance`, `program_costs`, `brand_settings`, `audit_logs`
- CS tidak bisa menulis `period_locks`
- CS bisa membaca `programs` dan `program_prices`
- CS membaca closing miliknya sendiri lewat `v_closings_cs`, dan hak SELECT langsung pada tabel `closings` sudah dicabut
- Kolom `cost_at_transaction`, `cost_of_sales`, `gross_profit` tidak pernah muncul di respons API manapun untuk role CS

Kebocoran HPP ke CS adalah kegagalan paling mahal di sistem ini. Uji lewat query langsung, lewat API, dan lewat export CSV.

### CC-B15 Auth, sesi, dan guard role [dep: B13]
Supabase Auth dengan cookie httpOnly, refresh otomatis, middleware Next.js yang memblokir rute berdasarkan role, endpoint `GET /api/me`.
**Selesai kalau:** sesi bertahan setelah aplikasi PWA ditutup dan dibuka lagi, dan CS yang membuka URL owner mendapat 403 dari server, bukan hanya disembunyikan di UI.

---

## Bagian D — API inti

### CC-B16 API lead reports [dep: B15, B04, B11]
POST menerima seluruh blok source dalam satu transaksi, menghormati `idempotency_key`, mengembalikan nilai `closing` hasil sistem. GET dengan filter tanggal dan CS. PATCH dengan validasi ulang.
**Selesai kalau:** kirim payload 3 blok dua kali dengan key sama menghasilkan 3 baris, bukan 6. Satu blok invalid membuat seluruh permintaan gagal tanpa menyisakan baris.

### CC-B17 API insights [dep: B16, B10]
`PUT` bersifat replace-all per stage supaya klien tidak perlu diff.

### CC-B18 API closings [dep: B15, B09]
Create dengan deteksi duplikat (409 berisi detail bentrok), `force: true` hanya untuk owner, cancel, list dengan filter, `GET /unlinked`, `POST /:id/link`.
**Selesai kalau:** alur duplikat menghasilkan 409 dengan nama CS dan tanggal bentrok, dan closing yang dibatalkan mengembalikan bucket di laporan asalnya.

### CC-B19b API program cost dan brand settings [dep: B15, B03, B13]
CRUD `program_costs` dan `brand_settings`, owner-only, dengan validasi periode tidak bertumpuk. Endpoint mengembalikan 403 untuk CS, bukan 404.

### CC-B19 API program, departure, price, price-lookup [dep: B15, B03]
`price-lookup` mengembalikan harga yang berlaku pada `closing_date`, atau `PRICE_NOT_FOUND`.
**Selesai kalau:** mengubah harga master hari ini tidak mengubah `total_value` closing kemarin. Test ini ditulis eksplisit.

---

## Bagian E — Analitik

### CC-B20 View funnel, sales, dan profitability [dep: B16, B18, B08b]
`v_lead_funnel_daily`, `v_closing_enriched`, `v_closings_cs`, `v_sales_by_closing_date`, `v_sales_by_lead_date`, `v_profitability`. Semua pembagi memakai `NULLIF`.

Tidak boleh ada kolom bernama `roas` di manapun. ROI dikembalikan sebagai rasio desimal, konversi ke persen hanya di layer presentasi.
**Selesai kalau:** dengan data fixture dari contoh PRD §11 (paket Rp32.900.000, margin 12%), `v_campaign_quality` menghasilkan closing rate A 2,0% dan B 12,0%, ROI A 690% dan B 2.269%, dan break-even CPP keduanya Rp3.948.000.

### CC-B21 View ads, campaign quality, CS performance, cohort maturity [dep: B20, B06]
Termasuk median interval memakai `percentile_cont`, dan kolom `campaign_attribution_rate` di `v_campaign_quality`.
**Selesai kalau:** lead tanpa `campaign_id` muncul sebagai baris `(tidak teratribusi)`, tidak dibuang, dan `campaign_attribution_rate` cocok dengan hitungan manual dari fixture.

### CC-B22 API dashboard [dep: B21]
Endpoint overview, funnel, campaigns, cs-performance, insights, reconciliation. Parameter `attribution` mengganti view sumber, bukan menghitung ulang di TypeScript.
**Selesai kalau:** mengganti mode attribution mengubah angka revenue dan ROI sesuai definisi, dan respons menyertakan `attribution_mode`, `cohort_maturity`, `campaign_attribution_rate`, dan `cost_coverage_rate` di meta.

### CC-B23 API management report bulanan [dep: B22]

---

## Bagian F — Export dan integrasi

### CC-B24 Export operational CSV [dep: B22]
Streaming, bukan buffer di memori. Tercatat ke `export_logs`.
**Selesai kalau:** 50.000 baris terunduh tanpa lonjakan memori, dan file dibuka rapi di Excel dengan BOM UTF-8.

### CC-B25 Export Meta LTV [dep: B24]
Pipeline query, filter consent, normalisasi, SHA-256, CSV. Formatter terpisah di `lib/exports/meta/`.
**Selesai kalau:** baris tanpa consent tidak pernah keluar, nomor keluar sebagai `62...` terhash, dan mengganti daftar kolom Meta hanya menyentuh satu file. Verifikasi daftar kolom ke dokumentasi Meta sebelum merge.

### CC-B26 Import CSV ads [dep: B06, B15]
Upload, preview mapping kolom, validasi, upsert idempoten per (level, entity, date), catat ke `sync_logs`.

### CC-B27 Period lock [dep: B11]
API kunci dan buka dengan alasan wajib, plus job auto-lock D+45. Nilai 45 disimpan sebagai setting per brand, bukan angka keras di kode, karena akan disetel ulang setelah median closing interval aktual diketahui.

### CC-B28 API audit log [dep: B12]
Filter user, tabel, rentang tanggal, pagination keyset.

---

## Bagian G — Frontend produksi

Prasyarat seluruh bagian ini: desain dari Claude Design sudah disetujui.

### CC-F01 Port design system [dep: desain final]
Token CSS, font, layout shell, bottom nav, tema. Komponen dasar diambil dari hasil DeepSeek (DS-18 sampai DS-25) dan dirangkai di sini.
**Selesai kalau:** halaman `/dev/components` menampilkan seluruh komponen sesuai desain di 380px, 768px, dan 1200px.

### CC-F02 Auth UI dan PWA [dep: CC-F01, B15]
Halaman login, proteksi rute, manifest, service worker, install prompt, penanganan sesi kedaluwarsa.

### CC-F02b Alur koreksi laporan H-7 [dep: CC-F03]
Tombol "Koreksi laporan lama" di beranda CS, daftar 7 hari terakhir dengan Stage Rail mini, membuka form yang sama dalam mode edit. Tolak dengan pesan jelas kalau periodenya sudah terkunci.
**Selesai kalau:** CS bisa menaikkan satu lead dari Cold ke Consultation pada laporan 3 hari lalu, dan total lead tidak berubah.

### CC-F03 Form laporan harian [dep: CC-F02, B16]
Blok source dinamis, Stage Rail langsung berubah saat mengetik, validasi sisa, kolom closing read-only, sticky bar, idempotency key, antrian offline.
**Selesai kalau:** matikan jaringan, isi laporan, simpan. Muncul banner tersimpan lokal. Nyalakan jaringan, laporan terkirim satu kali saja.

### CC-F04 Sheet lead insight [dep: CC-F03, B17]
Termasuk pembatas jumlah per stage yang mencerminkan aturan server.

### CC-F05 Wizard closing [dep: CC-F03, B18, B19]
Empat langkah, prefill harga dari `price-lookup`, toggle harga khusus, modal duplikat, ringkasan sebelum simpan.
**Selesai kalau:** memilih program dan keberangkatan mengisi harga otomatis, mengubah pax memperbarui total, dan nomor duplikat memunculkan modal dengan detail bentrok.

### CC-F06 Dashboard overview owner [dep: CC-F01, B22]
Filter sticky, toggle attribution, funnel Stage Rail besar, banner kematangan cohort, pemisahan visual antara bucket dan funnel.

Tambahan wajib:
- label "estimasi" pada rate funnel tengah, `closing_rate` tanpa label karena akurat
- banner peringatan saat `campaign_attribution_rate` di bawah 60%, berisi angka cakupannya
- kartu ROI sebagai metrik utama beraksen brass, tanpa ROAS di manapun
- kartu ganda CPP vs Break-even CPP dengan indikator jarak dan tiga warna ambang
- chip `estimasi` di sebelah ROI saat `cost_coverage_rate` di bawah 100%

### CC-F07 Campaign quality dan CS performance [dep: CC-F06]
Tabel bisa diurutkan di desktop, berubah jadi kartu di mobile.

### CC-F08 Reconciliation, management report, export center [dep: CC-F06, B23, B24, B25]
Termasuk penghitung consent di kartu export Meta.

### CC-F09 Master data admin [dep: CC-F01, B19, B19b]
Program, keberangkatan, riwayat harga sebagai timeline, dan layar HPP terpisah khusus owner dengan penanda visual jelas. Peringatan saat periode bertumpuk ditolak server.

### CC-F10 Lapisan offline dan retry [dep: CC-F03]
Antrian submit di IndexedDB, retry dengan backoff, indikator status sinkronisasi, penyelesaian konflik saat server menolak karena periode terkunci.

---

## Urutan eksekusi yang disarankan

```
Sprint 1  B01 B02 B03 B04 B05 B06 B07
Sprint 2  B08 B08b B09 B10 B11 B12 B13 B14
Sprint 3  B15 B16 B17 B18 B19 B19b
Sprint 4  B20 B21 B22 B23
Sprint 5  F01 F02 F03 F04 F05
Sprint 6  F06 F07 B24 B25
Sprint 7  F08 F09 F10 B26 B27 B28
```

B09 dan B14 adalah dua titik yang paling sering jadi sumber bug diam. B14 sekarang juga menjaga kerahasiaan HPP, jadi bobotnya naik. Jangan lanjut ke sprint berikutnya sebelum keduanya punya test yang lulus.
