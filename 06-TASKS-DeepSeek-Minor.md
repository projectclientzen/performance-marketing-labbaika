# Task List: DeepSeek — Minor

Semua task di sini terisolasi. Tiap task hanya menyentuh 1 sampai 3 file, tidak butuh membaca arsitektur, dan punya input dan output yang bisa diuji langsung.

## Aturan yang tidak boleh dilanggar

DeepSeek **tidak** mengerjakan:
- file migrasi yang berisi trigger, constraint exclusion, atau RLS
- SQL agregat, view, atau rumus metrik apapun
- endpoint yang menulis ke database
- logika autentikasi dan permission
- apapun yang butuh mengubah lebih dari 3 file

Kalau sebuah task terasa butuh konteks di luar file yang disebut, hentikan dan kembalikan ke Claude Code.

Konvensi: branch `ds/<id>-<slug>`. Setiap fungsi murni wajib punya file test berdampingan.

---

## A. Seed dan konstanta

### DS-01 Seed wilayah Indonesia
File: `supabase/seed/regions.sql`
Isi tabel `regions` dengan 38 provinsi dan seluruh kabupaten/kota. Struktur: `(id, level, name, parent_id)`, level `province` atau `city`. Sumber data: daftar wilayah administratif Kemendagri. Pakai kode wilayah resmi sebagai `id` kalau tersedia.
**Selesai kalau:** query `select count(*) from regions where level='province'` mengembalikan 38, dan setiap kota punya `parent_id` yang valid.

### DS-02 Seed lead sources
File: `supabase/seed/lead_sources.sql`
Facebook LP, Facebook CTWA, Google, Organic, Referral, Other. Dengan `slug` dan `sort_order`.

### DS-03 Seed kategori insight
File: `supabase/seed/insight_categories.sql`
15 kategori sesuai `02-PRD-v1.1.md` §6, dengan slug dan urutan.

### DS-04 Konstanta dan tipe enum TypeScript
File: `lib/constants/enums.ts`, `lib/constants/enums.test.ts`
Definisikan `LEAD_STAGES`, `ROOM_TYPES`, `PAYMENT_STATUS`, `AD_LEVELS`, `USER_ROLES`, `ERROR_CODES`, beserta label bahasa Indonesia dan warna token untuk stage. Ekspor sebagai `as const` dengan tipe turunan.
**Selesai kalau:** tipe union terbentuk otomatis, tidak ada string literal yang diketik ulang di tempat lain.

### DS-05 Peta pesan error
File: `lib/constants/error-messages.ts`
Petakan setiap kode error ke kalimat bahasa Indonesia yang menjelaskan cara memperbaikinya. Contoh: `STAGE_UNDERFLOW` menjadi "Jumlah lead di stage ini tidak cukup. Periksa laporan tanggal tersebut."

---

## B. Utilitas murni

Semua di `lib/utils/`, masing-masing dengan test.

### DS-05b Format persentase dan rasio
File: `lib/utils/percent.ts`
`formatPercent(0.1234)` menghasilkan `12,3%`. `formatROI(9.08)` menghasilkan `908%`. `formatMultiple(9.08)` menghasilkan `9,1x` untuk dipakai di tooltip. Nilai `null` menghasilkan `-`, bukan `0%` dan bukan `NaN%`.
Uji: nol, negatif (ROI bisa minus saat rugi), nilai sangat besar, dan `null`.

Catatan: sistem tidak memakai ROAS. Jangan buat helper `formatRoas`.

### DS-06 Format rupiah
`formatRupiah(32900000)` menghasilkan `Rp32.900.000`. `formatRupiahShort(4200000000)` menghasilkan `Rp4,2 M`. `parseRupiah('Rp32.900.000')` menghasilkan `32900000`.
Uji: nol, negatif, satu digit, miliar, input kotor dengan spasi.

### DS-07 Normalisasi nomor Indonesia
`normalizePhoneID(input)` menghasilkan `+628...` atau `null`.
Kasus uji wajib: `08123456789`, `8123456789`, `628123456789`, `+62 812-3456-789`, `+62812 3456 789`, `0812-3456-789`, `+6281234567890`, `021555000` (tolak), `+60123456789` (tolak), string kosong (tolak), `08 12 34` (tolak, terlalu pendek), nomor dengan huruf (tolak).
Perilaku harus sama persis dengan fungsi SQL `normalize_wa_id` di CC-B08. Salin daftar kasus uji ke kedua sisi.

### DS-08 Utilitas tanggal
`formatDateID('2026-08-19')` menghasilkan `19 Agu 2026`. `formatDateLong` menghasilkan `19 Agustus 2026`. `todayJakarta()` mengembalikan `YYYY-MM-DD` di zona Asia/Jakarta. `intervalDays(lead, closing)` mengembalikan selisih hari, hari yang sama = 0. `monthKey('2026-08-19')` menghasilkan `2026-08`.
Uji: pergantian bulan, tahun kabisat, dan panggilan `todayJakarta()` saat jam sistem UTC menunjukkan hari sebelumnya.

### DS-09 Helper hashing dan normalisasi Meta
File: `lib/exports/meta/normalize.ts`
`sha256Hex(text)` mengembalikan hex huruf kecil. `normalizeForMeta.phone`, `.email`, `.name`, `.city`, `.state` masing-masing trim, lowercase, dan membuang tanda baca sesuai aturan di `04-BRIEF-BE.md` §7. Nilai kosong tetap kosong, jangan jadi hash dari string kosong.
**Selesai kalau:** `normalizeForMeta.phone('+62 812-3456-789')` menghasilkan `62812345678 9` tanpa spasi dan tanpa tanda plus, dan nilai `null` menghasilkan `''` bukan hash.

### DS-09b Matematika profit untuk tampilan
File: `lib/utils/profit.ts`
Fungsi murni menerima `{ revenue, cost_of_sales, ad_spend, closing_count }` dan mengembalikan `gross_profit`, `margin_pct`, `net_contribution`, `roi`, `cpp`, `breakeven_cpp`, `ad_cost_ratio`. Semua pembagian dengan penyebut nol mengembalikan `null`.

Tambahkan `cppStatus(cpp, breakeven)` yang mengembalikan `'safe' | 'warning' | 'over'` dengan ambang 70% dan 100% dari break-even. Dipakai untuk warna kartu di dashboard.

**Selesai kalau:** hasil untuk contoh Campaign A dan B di `02-PRD-v1.3.md` §11 sama persis, termasuk ROI 690% dan 2.269%.

### DS-10 Matematika funnel untuk tampilan
File: `lib/utils/funnel.ts`
Fungsi murni yang menerima `{ total_lead, cold, consultation, offering, closing }` dan mengembalikan nilai kumulatif serta seluruh rate. Semua pembagian dengan penyebut nol mengembalikan `null`, bukan `0` dan bukan `NaN`.
**Selesai kalau:** hasil untuk data Campaign A dan B di `02-PRD-v1.1.md` §11 sama persis dengan tabel di dokumen itu.

### DS-11 Penulis CSV
File: `lib/utils/csv.ts`
Escaping tanda kutip dan koma, pemisah baris CRLF, BOM UTF-8 opsional, dan versi generator untuk streaming baris.
Uji: nilai berisi koma, tanda kutip ganda, baris baru, dan karakter Indonesia.

### DS-12 Amplop respons API
File: `lib/api/envelope.ts`
`ok(data, meta?)` dan `fail(code, message, fields?)` yang membentuk bentuk respons di `04-BRIEF-BE.md` §6, plus pemetaan kode ke status HTTP.

---

## C. Skema validasi

Semua di `lib/schemas/`, memakai Zod, dipakai bersama oleh FE dan BE.

### DS-13 Skema laporan harian
`leadReportBlockSchema` dan `leadReportPayloadSchema`. Aturan: semua angka bilangan bulat non-negatif, `cold + consultation + offering` tidak melebihi `total_lead`, `source_id` wajib, `date` tidak boleh masa depan dan tidak lebih dari 7 hari ke belakang untuk role CS.

### DS-14 Skema closing
`closingSchema` dengan seluruh field di `02-PRD-v1.1.md` §8.1. Aturan: `closing_date >= lead_date`, `pax >= 1`, `paid_amount <= total_value`, WhatsApp lolos `normalizePhoneID`, `price_note` wajib kalau `is_price_override` bernilai true, `pdp_consent_at` wajib kalau `pdp_consent` true.

### DS-15 Skema program, departure, price
Termasuk aturan `end_date` kalau ada harus setelah `effective_date`.

### DS-16 Skema query dashboard
Parsing dan validasi query string: rentang tanggal, `attribution` (`cash` atau `cohort`), array source dan campaign, pagination. Sediakan default yang aman.

### DS-17 Konfigurasi kolom export operational
File: `lib/exports/operational/columns.ts`
Array deklaratif berisi `{ key, header, accessor, format }` sesuai daftar kolom di `02-PRD-v1.1.md` §14.1. Tidak ada query di file ini.

### DS-18 Konfigurasi kolom export Meta
File: `lib/exports/meta/columns.ts`
Struktur sama, menandai kolom mana yang di-hash dan normalizer mana yang dipakai. Beri komentar bahwa daftar ini wajib dicek ulang ke dokumentasi Meta sebelum rilis.

---

## D. Komponen UI

Semua di `components/ui/`. Ambil warna, tipografi, dan ukuran dari token yang sudah ditetapkan di `03-BRIEF-FE-ClaudeDesign.md` §2. Komponen tidak boleh melakukan fetch data.

### DS-19 StageRail
Tiga ukuran: `mini`, `medium`, `large`. Props: nilai tiap stage, ukuran, tampilkan angka atau tidak. Segmen proporsional, warna dari token stage, transisi 200ms, hormati `prefers-reduced-motion`. Saat semua nilai nol, tampilkan batang abu-abu kosong, bukan pembagian nol.

### DS-20 NumberStepper
Input angka dengan tombol minus dan plus berukuran minimal 44px, keyboard numerik di mobile, batas minimum dan maksimum, tahan input non-angka. Props: value, onChange, min, max, label, hint, error.

### DS-21 MetricCard
Label, angka besar dengan IBM Plex Mono, delta opsional dengan panah, varian `default` dan `accent` (aksen brass), chip status opsional (misalnya `estimasi`), state loading berupa skeleton.

### DS-21b ThresholdCard
Kartu dua angka bersebelahan untuk CPP versus Break-even CPP. Menampilkan batang tipis yang menunjukkan posisi angka aktual terhadap batas, dengan tiga warna dari `cppStatus` di DS-09b. Props: label kiri, nilai kiri, label kanan, nilai kanan, status. Tanpa fetch.

### DS-22 EmptyState, ErrorState, LoadingSkeleton
Tiga komponen dengan slot judul, penjelasan, dan satu aksi. Teks default mengikuti aturan tulisan di `03-BRIEF-FE-ClaudeDesign.md` §3.

### DS-23 Banner dan Toast
Varian info, warn, danger, ok. Banner untuk status offline dan periode terkunci. Toast muncul dari bawah di mobile, dari kanan atas di desktop, otomatis hilang setelah 4 detik kecuali varian danger.

### DS-24 BottomSheet
Naik dari bawah, ada handle geser, backdrop, penguncian scroll, fokus terperangkap, tutup dengan Escape. Dipakai oleh sheet lead insight.

### DS-25 DataTable responsif
Desktop menampilkan tabel dengan header bisa diurutkan dan angka rata kanan memakai tabular figures. Di bawah 768px berubah jadi daftar kartu. Props deklaratif berisi definisi kolom. Tanpa fetch, tanpa pagination internal.

### DS-26 FilterBar
Chip filter yang bisa dihapus, pembungkus date range picker, dan toggle dua pilihan untuk mode attribution beserta tooltip penjelas.

---

## E. Halaman sederhana

### DS-27 Halaman program untuk CS
Read-only. Daftar program, keberangkatan, dan tabel harga per room type. Ambil data lewat props atau fetch GET yang sudah tersedia, tanpa mutasi.

### DS-28 Halaman preview komponen
Rute `/dev/components` yang menampilkan seluruh komponen DS-19 sampai DS-26 dalam semua varian dan state. Dipakai untuk tinjauan visual dan regresi manual.

---

## F. Aset dan dokumentasi

### DS-29 Aset PWA
Ikon 192, 384, 512, maskable, favicon, apple-touch-icon, `manifest.json` dengan nama, warna tema `#0E1626`, orientasi portrait, display standalone. Tag meta di root layout.

### DS-30 Berkas teks UI terpusat
File: `lib/copy/id.ts`
Seluruh string bahasa Indonesia di satu tempat, dikelompokkan per layar. Tidak ada teks yang ditulis langsung di komponen. Ini menyiapkan jalan kalau nanti butuh bahasa lain.

### DS-31 README dan dokumen setup
Cara menjalankan lokal, mengisi env, menjalankan migrasi dan seed, menjalankan test, dan penjelasan struktur folder. Sertakan `.env.example` lengkap tanpa nilai rahasia.

### DS-32 Skrip data dummy untuk development
File: `scripts/seed-dev.ts`
Menghasilkan 3 CS, 3 program dengan keberangkatan dan harga, 60 hari laporan harian dengan distribusi stage yang masuk akal, dan 40 closing dengan interval acak 0 sampai 30 hari. Angka harus konsisten dengan invarian sistem sehingga tidak ditolak constraint.
**Selesai kalau:** skrip jalan pada database kosong dan dashboard menampilkan angka yang wajar.

---

## Ringkasan pemetaan

| Kelompok | Task | Perkiraan |
|---|---|---|
| Seed dan konstanta | DS-01 sampai DS-05 | ringan, paralel |
| Utilitas murni | DS-05b, DS-06 sampai DS-12 | butuh test ketat |
| Skema validasi | DS-13 sampai DS-18 | acuannya PRD, bukan kode |
| Komponen UI | DS-19 sampai DS-26 | butuh desain final dulu |
| Halaman sederhana | DS-27, DS-28 | setelah komponen jadi |
| Aset dan dokumen | DS-29 sampai DS-32 | bisa kapan saja |

DS-01 sampai DS-18 bisa dikerjakan bersamaan dengan Sprint 1 dan 2 Claude Code karena tidak bersinggungan. DS-19 sampai DS-28 menunggu desain dari Claude Design disetujui.

## Titik serah terima yang rawan

Tiga tempat di mana DeepSeek dan Claude Code menyentuh hal yang sama. Sepakati lebih dulu supaya tidak bentrok.

1. **Normalisasi nomor** ada dua implementasi, TypeScript (DS-07) dan SQL (CC-B08). Satu daftar kasus uji dipakai keduanya. Kalau hasilnya berbeda, SQL yang menang.
2. **Rumus funnel** ada di SQL view (CC-B20) dan helper TypeScript (DS-10). Helper TS hanya untuk pratinjau langsung di form CS. Angka yang ditampilkan di dashboard selalu berasal dari server.
3. **Rumus profit** ada di SQL view `v_profitability` (CC-B20) dan helper TypeScript (DS-09b). Helper TS hanya untuk pratinjau dan format. Angka di dashboard selalu dari server. Kalau berbeda, SQL yang menang.
4. **Aturan validasi** ada di Zod (DS-13, DS-14) dan constraint database (CC-B04, CC-B05). Zod memberi pesan ramah lebih awal, database yang menjamin. Jangan ada aturan yang hanya hidup di Zod.
