# PRD Labbaika Purchase CAPI

Versi 1.0, 7 Oktober 2026. Pemilik produk: Maszen. Pelaksana aplikasi: Codex. Integrasi akun dan deployment: Hermes. Status: rancangan implementasi yang mengikuti keputusan produk pengguna; aktivasi produksi menunggu verifikasi integrasi. Repository: https://github.com/projectclientzen/performance-marketing-labbaika, baseline `048df9373c669e001d4dcd4a1ce70e13cfa83e81`.

## Keputusan produk

DP pertama yang benar-benar diterima memicu **satu Purchase per booking**, dengan `value = total_value` pada transaksi, dalam IDR. Nilai bukan nominal DP, bukan harga katalog terbaru, dan bukan nilai per pax bila booking berisi beberapa pax. Contoh: harga snapshot Rp30 juta × 2 pax, DP Rp10 juta → satu Purchase bernilai Rp60 juta. Pembayaran penuh langsung tanpa DP mengikuti aturan yang sama. Cicilan dan pelunasan booking yang sama tidak menambah Purchase.

`total_value` normalnya sama dengan `price_at_transaction × pax`. Override harga yang sah harus mempunyai catatan dan snapshot nilai final yang disepakati. Pajak/biaya tambahan tidak ditambahkan di luar nilai booking yang tersimpan. Uang diterima (`paid_amount`) tetap menjadi ukuran pembayaran operasional tersendiri. ROAS booking, ROAS berbasis penerimaan kas, dan ROAS yang dilaporkan Meta tidak boleh dicampur.

Saat ini CS menggunakan WhatsApp Business app di HP/Web. Tidak ada asumsi akses Cloud API, webhook, `ctwa_clid`, atau dukungan optimasi Purchase pada akun. Fase awal adalah pengiriman transaksi chat dari server. CTWA Business Messaging adalah integrasi berikutnya setelah sumber identitas referral yang valid tersedia dan skema Meta dikonfirmasi Hermes.

## Tujuan dan ukuran keberhasilan

1. CS mencatat booking satu kali; data yang sama menjadi sumber laporan dan calon event.
2. Seluruh event yang dikirim membawa nilai booking dan waktu DP asli yang benar.
3. Tidak ada Purchase tambahan akibat cicilan, klik ulang, proses worker bersamaan, atau perubahan profil.
4. Penyimpanan booking tidak bergantung pada keberhasilan jaringan Meta.
5. Setiap keputusan kirim/tahan dan hasil pengiriman dapat ditelusuri tanpa membocorkan token atau data pelanggan dalam log.
6. Dashboard membedakan transaksi aktual, event diterima, dan hasil atribusi Meta.

Target teknis: 0 event produksi saat mode off/dry run; 0 payload memakai nominal DP sebagai value; 0 pengiriman untuk nominal nol/refund/batal/tanpa persetujuan; 0 tanggal historis diganti menjadi sekarang. Target operasional setelah aktivasi: ≥95% booking layak masuk antrean tanpa input ulang; latensi antrean dipantau terhadap SLA worker yang disetujui Hermes. Ini target implementasi, bukan hasil pengukuran saat ini. CPA/ROAS membaik adalah hipotesis yang harus diuji, bukan jaminan.

## Kondisi project

Next.js 14 App Router, TypeScript, React, Supabase/PostgreSQL. Endpoint `app/api/closings/route.ts` menyimpan data closing; update pembayaran melalui `app/api/closings/[id]/route.ts`. CS membaca/memperbarui view `v_closings_cs`; owner membaca tabel dasar. Pola ini harus dipertahankan, termasuk isolasi brand dan kepemilikan CS.

Meta sync di `app/api/ads/meta-sync/route.ts` mengambil statistik campaign dan percakapan dimulai. Meta LTV di `app/api/exports/meta-ltv/route.ts` merupakan CSV audience, bukan CAPI. Export Gass Apps juga belum merupakan bukti delivery. Lead harian adalah agregat per CS/sumber/tanggal, sehingga tidak dapat langsung dijadikan event individual.

Temuan yang ditangani pada jalur CAPI: nominal pembayaran nol, status refund, identitas email, timestamp pembayaran yang belum ada, snapshot nilai, dan deduplikasi. Perubahan definisi metrik historis, pengelolaan refund sebagian, serta perbaikan export lama harus dilaksanakan sebagai task tersendiri agar angka laporan tidak berubah diam-diam.

## Ruang lingkup

Fase 1: spesifikasi, eligibility dan payload deterministik, simulasi file, timestamp DP pada closing, antrean atomik, konfigurasi server, pengiriman generic chat dengan mode test/live yang terkunci, dan monitoring. Pengujian default lokal menggunakan data sintetis. Data September nyata belum tersedia di checkout; Hermes dapat mengekspor atau Maszen memberikan Excel.

Fase 2: capture referral WhatsApp yang didukung, pencocokan lead individual, rute Business Messaging, dan verifikasi atribusi CTWA. Fase 3: pembacaan Purchase/values Ads Insights dan eksperimen dampak optimasi. Fase 2 dan 3 tidak diklaim sudah tersedia oleh keberhasilan Fase 1.

Di luar fase awal: pembayaran otomatis/payment gateway, bot WhatsApp, scraping sesi WhatsApp Web, CRM penuh, qualified lead dari laporan agregat, pengiriman negatif untuk membatalkan Purchase, dan backfill massal September ke produksi.

## Aturan kelayakan

| Kondisi | Perilaku |
|---|---|
| DP/cicilan pertama positif, bukti waktu DP tersedia, consent valid | Calon satu Purchase full booking value |
| Langsung lunas, nominal sama dengan total booking | Calon satu Purchase |
| DP nol, total nol, pembayaran melebihi booking | Ditahan, koreksi data |
| Lunas tetapi nominal belum sesuai | Ditahan, koreksi data |
| Refunded atau cancelled | Tidak membuat Purchase baru; hentikan antrean yang belum dikirim |
| Tidak ada consent pemasaran | Ditahan; checkbox tidak otomatis dicentang oleh sistem |
| Timestamp DP hilang atau masa depan | Ditahan; jangan mengganti dengan waktu input/import |
| Event lebih tua dari kebijakan route terverifikasi | Hanya simulasi/arsip, tidak dikirim oleh worker |
| Cicilan/pelunasan setelah Purchase | Update operasional saja |
| Identitas/nilai/waktu dikoreksi saat event mengantre | Tahan untuk pemeriksaan, jangan diam-diam mengganti snapshot |
| Refund sesudah Meta menerima event | Simpan status koreksi internal; tidak mengklaim event Meta terhapus |
| Booking group memakai satu nomor PIC | Satu event untuk booking; pax adalah jumlah peserta, bukan pengali jumlah Purchase |

`first_payment_received_at` adalah timestamp dengan zona waktu dari kejadian pembayaran pertama yang telah dikonfirmasi, bukan `created_at` atau tanggal upload. UI menerima waktu WIB; API menyimpan ISO UTC. Consent boleh direkam setelah waktu pembayaran, tetapi harus valid sebelum pengiriman. Waktu pencatatan consent tidak boleh dianggap bukti tanggal persetujuan yang lebih awal.

Maksimum umur event pada simulator default tujuh hari sebagai **kebijakan konservatif sementara**, bukan pernyataan universal semua produk Meta. Worker outbound harus menggunakan konfigurasi umur yang secara eksplisit diverifikasi Hermes. Umur event, jendela atribusi klik, dan jendela deduplikasi adalah tiga aturan berbeda.

## Arsitektur dan kontrak data

Alur: form closing → transaksi PostgreSQL menyimpan booking dan satu baris outbox → worker server mengambil lease → memeriksa ulang eligibility dan konfigurasi → membentuk payload minimum → POST Meta → menyimpan hasil teredaksi.

`capi_settings` per brand: mode `off/dry_run/test/live`, dataset nonrahasia, activation timestamp milik server. Tidak menyimpan access token di tabel yang dapat dibaca pengguna.

`capi_events`: UUID, brand, closing, event ID stabil, mode, status, snapshot nilai IDR, waktu DP asli, attempt counter, waktu percobaan berikutnya, lease token, lease deadline, kode kegagalan, accepted timestamp, created/updated timestamps. Tidak menyimpan payload PII mentah. Event ID produksi: `labbaika:booking:<closing_uuid>:purchase:v1`. Penyimpanan idempotent di aplikasi/database wajib; deduplikasi Meta bukan pengganti constraint internal.

Status: pending → processing → accepted; penolakan yang pasti belum diterima dapat menjadi failed untuk retry terbatas; timeout/hasil ambigu/lease kedaluwarsa menjadi held. cancelled hanya menyatakan antrean lokal dihentikan. Mengubah mode menahan antrean lama; tidak mempromosikan data simulasi/test ke live.

SQL trigger tidak memanggil jaringan. Antrean dibuat hanya untuk transaksi baru sejak integrasi diaktifkan, dengan waktu DP setelah aktivasi. Data lama tidak otomatis diikutkan saat pemasangan atau perubahan mode. Satu booking yang sudah masuk antrean tidak otomatis dibuat ulang lintas mode; pengujian memakai fixture atau transaksi baru yang berbeda.

Worker service-role harus dibatasi brand yang dikonfigurasi, menggunakan row locks/skip locked dan lease token. Proses completion harus menolak lease lama. Perubahan status booking/consent harus diperiksa lagi sesaat sebelum request. Race yang masih mungkin antara pemeriksaan dan API dicatat sebagai batas sistem; pembatalan tidak dapat menarik request yang sudah terkirim.

## Payload dan konfigurasi

Fase awal `Purchase`, `action_source=chat`, event_time waktu DP, event_id stabil, `custom_data.value=total_value`, `currency=IDR`, identitas pelanggan dinormalisasi dan di-hash sesuai kontrak route. Tidak mengirim cookies, IP, atau user agent dari perangkat CS. Tidak mengisi `ctwa_clid` palsu atau `action_source=website` hanya karena form internal berbasis web.

Payload minimum tidak menyertakan nama paket ibadah, itinerary, isi percakapan, data paspor, ataupun informasi sensitif lain. Hermes wajib memeriksa eligibility kategori bisnis/data source dan ketentuan penggunaan Meta sebelum outbound; jangan menggunakan generic event untuk menghindari pembatasan kategori.

Konfigurasi server terpisah dari token sinkronisasi Ads: `META_CAPI_ACCESS_TOKEN`, `META_CAPI_DATASET_ID`, `META_CAPI_BRAND_ID`, `META_CAPI_API_VERSION`, `META_CAPI_MAX_EVENT_AGE_SECONDS`, `META_CAPI_ROUTE_VERIFIED`, `META_CAPI_ALLOW_LIVE`, `META_CAPI_TEST_EVENT_CODE`, `CAPI_WORKER_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`. Tidak ada default versi API produksi. Tanpa verifikasi route, worker gagal tertutup. Test memerlukan test code; live tidak menambahkan test code. UI menampilkan readiness, tidak nilai rahasia.

## Cara mendapatkan identitas CTWA

Rute utama yang diteliti Hermes: onboarding nomor ke WhatsApp Business Platform/Cloud API secara resmi, atau provider resmi yang memberikan referral click identifier. Jika ingin mempertahankan penggunaan app yang sama, periksa eligibility dan dukungan Coexistence pada nomor/provider; jangan menjanjikan semua akun/fitur tersedia.

Webhook pesan masuk harus diverifikasi signature dan dideduplikasi melalui message ID. Simpan referral asli: ctwa_clid jika ada, WABA/nomor penerima, identitas kontak, ID iklan/source bila diberikan, timestamp dan provenance. Jangan mengambil seluruh isi chat bila tidak diperlukan. Lead dari iklan harus dihubungkan ke booking menggunakan identitas kontak dan konfirmasi CS; nomor saja tidak boleh memilih sembarang referral saat kontak punya beberapa interaksi.

Rute Business Messaging hanya boleh diaktifkan setelah Hermes membuktikan data referral tersedia, aset saling terhubung, payload sesuai versi API, serta event cocok untuk tujuan optimasi akun. Referral yang tidak ada tetap missing. Nomor WhatsApp, campaign pilihan CS, atau URL dashboard bukan pengganti ctwa_clid. Data September tanpa referral tidak bisa dipulihkan hanya dari catatan nominal dan nomor.

## Pengalaman pengguna

CS mempertahankan form empat tahap. Tambahan waktu DP asli berada bersama nominal pembayaran; isian kosong berarti belum siap CAPI, tetap dapat menyimpan laporan operasional lama. Penjelasan singkat: nilai yang dikirim adalah total booking, cicilan tidak menambah Purchase. Riwayat/monitor menampilkan diterima Meta tanpa menyebut pasti teratribusi.

Owner/advertiser mengelola integrasi dan monitor; CS hanya melihat status miliknya. HRD tidak otomatis mendapat pengaturan kredensial karena role historisnya setara owner dalam helper umum. Fitur baru menggunakan izin tersendiri. Mode off adalah awal. Dataset harus sesuai konfigurasi server sebelum test/live.

## Trial September dan pembuktian hasil

Lihat `capi-trial-plan.md`. Data nyata disiapkan Hermes atau pengguna; jangan menganggap fixture sintetis sebagai data September. Export dibatasi periode September 2026 dan kolom yang diperlukan. Simulasi tidak memanggil Meta, tidak memperbarui database, dan hanya menghasilkan agregat alasan/nominal. Excel dikonversi dengan pemetaan eksplisit; timestamp kosong tetap kosong.

Tahap pembuktian: (1) cocokkan full booking value dan jumlah transaksi di simulator, (2) uji transport menggunakan fixture test dengan timestamp kejadian test saat itu, (3) pantau booking baru yang sungguh terjadi dan layak, (4) periksa delivery, matching diagnostics, dan campaign attribution secara terpisah, (5) eksperimen performa dengan pengaturan campaign sesuai eligibility.

Riwayat tidak diubah agar masuk jendela. Jangan mengirim seluruh September dengan event_time hari ini. Pada tanggal 7 Oktober, periksa umur setiap baris menggunakan waktu nyata, bukan menyatakan seluruh September pasti diterima atau pasti ditolak.

## Rencana pengujian dan penerimaan

Unit: DP10jt/booking60jt menghasilkan value60jt; lunas langsung; installments snapshot tetap; status negatif ditahan; consent; waktu zona WIB/UTC/future/missing/age; email plus tidak berubah; tidak ada CS identifiers; tidak ada empty hash.

Database lokal: setup off tidak mengantre; activation tidak backfill; insert closing/queue atomik; unique event; update cicilan tidak menambah; refund/consent revoke membatalkan pending; accepted tetap riwayat; worker dua proses tidak claim baris sama; lease lama ditolak; settings/CS/brand isolation; service role saja memanggil worker RPC. Bootstrap SQL test hanya untuk database disposable, bukan Supabase produksi.

Sender: tanpa konfigurasi tidak ada fetch; test menyertakan test code; live tidak; token via header; HTTP success tapi body invalid tidak accepted; rejection/429/timeout dibedakan; respons tidak dibocorkan; dry_run tidak mengirim. Build, lint, typecheck, unit, SQL diselesaikan sebelum deployment.

Penerimaan live oleh Hermes: bukti event server diterima dengan value/time benar; bukti event eligible dipetakan ke campaign bila route mendukung; bukti tujuan optimasi aktif; hasil pengujian dicatat tanpa token/PII. Keberhasilan Test Events bukan hasil atribusi produksi.

## Pembagian pekerjaan dan peluncuran

Daftar tugas kecil, dependency, pemilik, dan definisi selesai ada di `CAPI-TASKS.md`. Panduan Hermes ada di `hermes-capi-handoff.md`. Context kerja agen ada di `CAPI-CONTEXT.md`. Masing-masing file harus diperbarui saat kontrak berubah.

Peluncuran: branch terisolasi → review/test lokal → staging dengan dataset test → backup/migration oleh Hermes → verifikasi UI/RLS → canary produksi baru → observasi → perluasan. Tidak push ke main atau menjalankan migrasi produksi dari pekerjaan persiapan ini. Dokumen lama menyebut auto-pull main di VPS; Hermes wajib memverifikasi dan mencegah perubahan tak sengaja selama rollout.

Rollback: matikan mode dan izin live server, hentikan worker, tahan antrean belum terkirim, rollback aplikasi bila diperlukan. Jangan menghapus riwayat event accepted dan jangan mengklaim rollback lokal membatalkan event di Meta. Migration destructive rollback hanya di database disposable atau setelah backup dan pemeriksaan ketergantungan.

## Risiko yang perlu dicatat

Pengiriman generic chat dapat diterima tanpa atribusi CTWA; keterlambatan input DP menyebabkan event terlalu tua; consent tidak lengkap membatasi coverage; satu PIC dapat punya banyak booking; refund mengubah nilai ekonomi setelah event; API/aturan kategori berubah; timestamp lama hilang; hasil ambigu dapat membuat antrean perlu rekonsiliasi manual. Semua ini harus tampil sebagai status terukur, bukan disembunyikan dalam klaim bahwa Meta pasti lebih pintar.

## Referensi

- Baseline kode: https://github.com/projectclientzen/performance-marketing-labbaika/tree/048df9373c669e001d4dcd4a1ce70e13cfa83e81
- Contoh resmi referral CTWA: https://github.com/fbsamples/lead-ads-webhook-sample/blob/main/postman/FB%20Conversions%20API%20%28Part%201%20-%20online%29.postman_collection.json (arsip, acuan konsep; bukan otoritas versi terbaru).
- Jenis action source SDK Meta: https://github.com/facebook/facebook-java-business-sdk/blob/main/src/main/java/com/facebook/ads/sdk/serverside/ActionSource.java
- Dokumentasi yang harus diverifikasi Hermes: https://developers.facebook.com/docs/marketing-api/conversions-api/business-messaging/ dan https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/server-event/
