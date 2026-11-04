# Trial closing September — Labbaika

Versi 7 Oktober 2026. Data asli belum diterima. Hermes dapat mengekspor atau Maszen memberikan Excel. Fixture dalam repository sepenuhnya sintetis. September 2026 adalah asumsi kerja dari tanggal sesi; konfirmasikan tahun pada file sumber, jangan mengganti tahunnya agar lolos kelayakan.

## Tujuan dan tiga tahap

1. **Audit offline:** rekonsiliasi jumlah booking, nilai produk, nominal terbayar, duplikasi, consent, waktu DP, dan umur event. Tidak mengirim data ke Meta dan tidak mengubah database.
2. **Uji integrasi:** gunakan data sintetis baru pada lingkungan/dataset test yang didukung route. Waktu test adalah kejadian simulasi baru yang diberi identitas test; jangan menyamarkan closing September sebagai transaksi baru.
3. **Pilot riil:** setelah verifikasi Hermes, gunakan booking baru yang sungguh terjadi dan memenuhi syarat. Booking historis tidak otomatis dimasukkan ke antrean, termasuk yang masih berada dalam batas umur API.

September berguna untuk memeriksa kualitas data dan menghitung booking value. September tidak otomatis cocok untuk membuktikan atribusi CTWA atau menjalankan optimasi Purchase. Waktu DP, click ID, dan persetujuan yang tidak tercatat tidak boleh dibuat-buat.

## Kontrak export untuk Hermes

Satu baris per booking kanonik, bukan per cicilan dan bukan per jamaah. Pilih cohort berdasarkan `closing_date >= 2026-09-01 AND closing_date < 2026-10-01`, sertakan status batal/refund agar terlihat dalam audit. Jika analisis yang dimaksud adalah pembayaran pertama September, buat cohort terpisah berdasarkan waktu pembayaran; jangan mencampur kedua definisi.

| Kolom JSON/CSV | Sumber dan aturan |
|---|---|
| `id`, `brand_id`, `program_id` | ID booking/brand/program asli yang stabil; jangan pakai nomor urut export yang berubah |
| `first_name` | Parser legacy menerima string; boleh string kosong untuk minimisasi karena nama tidak dipakai payload |
| `whatsapp_e164` | Kontak pembeli/PIC booking yang sebenarnya; nomor Indonesia, simpan sebagai teks agar `+62` tidak rusak |
| `email` | Opsional; kosong bila tidak ada. Jangan membuat email pengganti |
| `pdp_consent` | Boolean `true`/`false` dari bukti yang tersedia, bukan persetujuan yang diinferensikan dari pembelian |
| `pdp_consent_at` | ISO 8601 dengan zona waktu; kosong/null jika bukti waktunya tidak ada |
| `payment_status` | `dp`, `partial`, `lunas`, `cancelled`, atau `refunded` |
| `paid_amount` | Rupiah integer; uang kumulatif yang benar-benar diterima, tanpa pemisah ribuan |
| `price_at_transaction` | Harga per pax yang disepakati saat booking, bukan harga master sekarang |
| `pax` | Jumlah pax positif; group tetap satu booking |
| `total_value` | Total nilai booking; biasanya harga snapshot × pax |
| `is_price_override`, `price_note` | Boolean dan alasan jika nilai berbeda; tidak mengarang diskon untuk meloloskan mismatch |
| `closing_date`, `lead_date` | Tanggal bisnis `YYYY-MM-DD`; lead_date opsional tetapi dianjurkan |
| `first_payment_received_at` | Waktu DP pertama diterima, dari bukti asli, ISO dengan zona waktu. Tidak sama dengan upload/input/keberangkatan |

Contoh timestamp: 29 September 2026 pukul 12:00 WIB = `2026-09-29T05:00:00Z`. Jika Excel hanya berisi tanggal, catat bahwa jam tidak diketahui; jangan mengisi tengah malam secara otomatis. Timestamp kosong ditahan dengan alasan yang jelas.

Parser saat ini menerima JSON array atau CSV UTF-8 berdelimiter koma, maksimal 20 MiB. Header CSV mengikuti tabel; boolean memakai `true/false`; angka tidak memakai `Rp`, titik ribuan, atau koma desimal. **Belum ada upload XLSX dalam UI**. Hermes mengonversi Excel ke format ini, dengan mapping kolom, timezone, jumlah baris, dan rekonsiliasi nilai sebelum/sesudah. Data mentah ditempatkan di folder privat di luar Git; jangan disertakan dalam PR atau ZIP handoff.

Untuk penelitian CTWA, export tambahan terpisah dapat memuat ketersediaan referral, waktu klik/chat, sumber provenance, WABA/nomor bisnis tujuan, dan hubungan ke booking. Simulator fase 1 tidak memakai atau mengirim ctwa_clid. Jangan menaruh click ID lengkap di hasil audit agregat.

## Menjalankan simulasi

Dari root repository dengan dependencies terpasang:

```sh
# Contoh sintetis pada clock yang ditentukan: membuktikan 60 juta vs DP 10 juta.
npm run capi:trial -- lib/capi/fixtures/synthetic-closing.json --now 2026-09-30T05:00:00Z

# Fixture yang sama pada 7 Oktober: ditahan karena lebih dari kebijakan sementara 7 hari.
npm run capi:trial -- lib/capi/fixtures/synthetic-closing.json --now 2026-10-07T05:00:00Z

# Export asli: clock aktual, tidak ada pengiriman API.
npm run capi:trial -- /path/privat/closing-september.json
```

Opsi `--max-age-seconds N` hanya setelah batas route terpilih diverifikasi. Default 604800 detik adalah kebijakan sementara simulator, bukan klaim bahwa semua CAPI punya batas yang sama. Opsi `--now` untuk simulasi yang dinyatakan eksplisit; worker produksi selalu memakai waktu aktual, tanpa override dari pengguna.

Hasil berisi `totalRows`, `eligibleRows`, `ineligibleRows`, `malformedRows`, `duplicateRows`, total booking value dan pembayaran pada baris layak, frekuensi alasan, dan peringatan. Tidak memuat nomor, email, nama, ID booking, hash identitas, payload, atau token. Satu baris bisa memiliki beberapa alasan, sehingga jumlah alasan tidak harus sama dengan jumlah baris tidak layak.

Duplikat memakai pasangan brand + booking ID; kemunculan pertama dipakai dan sisanya ditolak. Karena itu, Hermes wajib memastikan export satu snapshot terbaru per booking sebelum trial; simulator bukan mesin memilih status pembayaran terakhir dari banyak cicilan.

## Lembar penerimaan hasil

| Pemeriksaan | Bukti yang dicatat |
|---|---|
| Asal data | Pemilik export, tanggal export, periode/tahun, timezone, jumlah baris sumber |
| Rekonsiliasi | Booking unik, jumlah pax, nilai booking, uang diterima; cocokkan ke sumber dengan definisi status sama |
| Kelayakan | Jumlah invalid/missing/refund/cancel/duplicate/terlalu tua, termasuk beberapa alasan per baris |
| Kebijakan | Waktu evaluasi, batas umur dan sumber verifikasi; default sementara harus ditandai |
| Identitas | Berapa booking punya nomor valid, consent, referral asli; laporkan agregat saja |
| Keputusan | Offline only / perlu koreksi / kandidat test; tidak ada auto-enrollment ke produksi |

## Uji akun oleh Hermes

1. Catat commit, lingkungan, versi API, dataset dan route; secrets hanya di secret manager/server.
2. Kirim satu fixture test baru sesuai kontrak yang didukung. Buktikan `value` full booking, waktu benar, identitas test, response dan Events Manager sesuai. Status HTTP 200 saja tidak cukup.
3. Uji job ulang, dua worker bersamaan, consent dicabut, nominal berubah, dan timeout. Event ambigu tetap ditahan; tidak ditekan kirim ulang secara buta.
4. Setelah kesiapan live disepakati, aktifkan batas pilot pada booking baru. Catat jumlah layak, queued, accepted, held, serta alasan.
5. Periksa atribusi secara agregat dengan timezone, jendela atribusi, reporting basis dan definisi metric sama. Tidak ada receipt atribusi per pelanggan yang diasumsikan tersedia.
6. Periksa goal campaign/ad set: mengirim Purchase/value tidak otomatis mengubah optimasi dari conversations ke purchases/value. Eksperimen performa memerlukan desain dan anggaran tersendiri.

Definition of done trial offline: mapping terdokumentasi, agregat direkonsiliasi, semua kekurangan data tercatat, nol request Meta. Definition of done pilot akun mengikuti H07–H12 pada handoff Hermes.
