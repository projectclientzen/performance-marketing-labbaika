# Trigger CAPI dan report Labbaika

## Yang terlihat pada produk referensi

[Landing page Trigger CAPI](https://widyaherma.com/trigger-capi-lp) menawarkan halaman input closing: CS memilih produk, memasukkan kontak/nominal, lalu mengirim Purchase ke Meta. Halaman menyebut pencatatan spreadsheet, tampilan bermerek sendiri, paket file mandiri, pemasangan, dan beberapa brand. Bukti yang dipamerkan berfokus pada Purchase yang tampil di Events Manager; terdapat klaim perbaikan biaya closing dan kualitas leads dari pengalaman penjual. Itu klaim penjual, belum merupakan eksperimen independen.

[Onboarding pemasangan](https://widyaherma.com/trigger-capi-onboarding-dfy.html) meminta Pixel ID, kesiapan token CAPI, mata uang, daftar produk/harga, identitas brand, dan akun Cloudflare. Ini konsisten dengan alat input transaksi dan koneksi server ke Meta. Kode backend, endpoint produksi, skema payload, pengamanan token, deduplikasi dan pencocokan CTWA tidak terbuka dari materi tersebut. Karena itu, dukungan `ctwa_clid` atau optimasi CTWA tidak dapat dipastikan dari landing page.

Materi menampilkan Test Events/Processed sebagai bukti penerimaan. Penerimaan teknis harus dibedakan dari atribusi campaign dan penggunaan dalam optimasi. Angka jendela atribusi pada materi pemasaran juga harus diverifikasi terhadap setting/jalur aktual, bukan dijadikan batas universal.

Catatan sumber: snapshot HTML publik dibaca pada sesi analisis 6 Oktober 2026; pengambilan ulang via web tool 7 Oktober tidak tersedia. Fitur/penawaran bisa berubah. Tidak ada akses ke kode atau akun pelanggan vendor.

## Korelasi dengan codebase Labbaika

| Kebutuhan | Aset Labbaika yang sudah ada | Rancangan integrasi |
|---|---|---|
| Data pelanggan saat closing | Form CS, WhatsApp, consent, program, pax, pembayaran | Pakai catatan yang sama; hindari form kedua yang harus diisi ulang |
| Daftar produk dan nilai | Master program/harga serta snapshot transaksi | Purchase memakai total nilai booking saat DP pertama |
| Catatan sumber transaksi | UUID closing, CS, brand, program | Event identity mengikuti booking kanonik |
| Pembukuan/report | Dashboard, riwayat, export | Tambahkan status pengiriman; kas dan booking value tetap dibedakan |
| Laporan iklan | Sinkronisasi statistik Meta yang masuk ke dashboard | Tambahkan aliran keluar hasil closing; sync statistik tidak otomatis berarti CAPI |
| Pengiriman andal | Belum ada CAPI pada baseline | Outbox atomik, worker server, batas percobaan dan penanganan hasil ambigu |
| Atribusi CTWA | Belum ada referral individual; laporan lead agregat | Fase2 butuh capture referral resmi dan hubungan conversation → booking |

Alur target Labbaika:

```mermaid
flowchart LR
  A[CS mencatat booking dan DP nyata] --> B[Validasi nilai, consent, waktu asli]
  B --> C[Booking dan antrean tersimpan bersama]
  C --> D[Worker memeriksa kelayakan lagi]
  D --> E[Purchase: total nilai booking]
  E --> F[Status diterima atau perlu diperiksa]
  G[Klik iklan CTWA] --> H[Webhook WhatsApp resmi]
  H --> I[Referral asli terhubung ke booking]
  I -. Fase 2 .-> E
  F --> J[Periksa atribusi dan goal iklan terpisah]
```

Inti produk yang dapat diadaptasi adalah pelaporan hasil penjualan manual. Keunggulan rancangan Labbaika berasal dari integrasi langsung dengan booking, snapshot harga, pemisahan akses, dan antrean yang dapat diperiksa. Klaim peningkatan performa iklan tetap membutuhkan pembuktian pada akun sendiri. Pembangunan ini tidak menyalin source code vendor atau membeli layanannya.
