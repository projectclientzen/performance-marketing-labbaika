# Context untuk agen berikutnya / Hermes

Project: **Labbaika Booking Purchase CAPI**. Tanggal 7 Oktober 2026. Repo `projectclientzen/performance-marketing-labbaika`. Branch lokal `codex/labbaika-capi-booking-value`, baseline `048df9373c669e001d4dcd4a1ce70e13cfa83e81`. Workspace `/Volumes/Daily Project/AI PROJECT ZEN/labbaika-capi`. Checkout awal `/Volumes/Daily Project/Performance report Labbaika` tidak diubah.

## Baca berurutan

1. [PRD](PRD-LABBAIKA-CAPI.md): aturan bisnis yang sudah diputuskan pengguna.
2. [Perbandingan produk](TRIGGER-CAPI-COMPARISON.md): hubungan landing page dengan report.
3. [Task kecil](CAPI-TASKS.md): pekerjaan lokal selesai dan integrasi yang masih menunggu.
4. [Handoff Hermes](hermes-capi-handoff.md): akun/API/WhatsApp, definisi pembuktian.
5. [Trial September](capi-trial-plan.md): export/mapping/run simulator.
6. [Validasi](VALIDATION-CAPI.md): hasil nyata dan batas yang belum diuji.

## Keputusan yang jangan ditafsir ulang

- DP **positif dan nyata** → satu Purchase sebesar **total produk/booking**, bukan DP. 2 pax × 30 juta = value60 juta walaupun DP10 juta.
- Harga dari transaksi, bukan katalog terkini. Cicilan/pelunasan tidak membuat Purchase baru.
- Waktu DP asli wajib untuk CAPI; legacy boleh kosong agar laporan operasional tidak dipaksa membuat timestamp palsu.
- WhatsApp user masih Business app HP/Web. Tidak ada webhook/click ID yang boleh diasumsikan tersedia.
- Closing September belum diberikan. Hermes dapat export atau pengguna memberikan Excel. Fixture repository bukan data asli.
- Pengguna meminta PRD, rincian task, pelaksanaan dengan subagen, dan Hermes menangani akses API. Belum ada konfigurasi akun/live yang dipasang.

## Peta kode

| Area | File |
|---|---|
| Eligibility/payload/hash/stable ID | `lib/capi/index.ts` |
| Offline parser/aggregate/CLI | `lib/capi/trial.ts`, `scripts/capi-trial.ts` |
| Transport + credential gates | `lib/meta-capi/delivery.ts` |
| Worker/readiness/history | `app/api/capi/{worker,settings,events}/route.ts` |
| Owner monitor | `app/owner/capi/page.tsx` |
| Closing form/update | `app/cs/closing/page.tsx`, `app/cs/closing/riwayat/[id]/page.tsx` |
| Payload validation | `lib/schemas/closing.ts`, API closings |
| DB and RLS | `supabase/migrations/032_capi_outbox.sql` |
| SQL tests | `tests/sql/032_capi_outbox.sql`, local bootstrap |

RLS: CS memakai view `v_closings_cs`, tidak membaca base table closings. Owner/advertiser mengelola settings; HRD tidak diberi akses integrasi walau helper lama memasukkannya sebagai owner-like. Worker service-role dibatasi config brand dan lease. Jangan memindahkan token ke browser.

Konfigurasi Supabase public masih dipin di `lib/supabase/config.ts` mengikuti repository asli. Verifikasi proyek/lingkungan sebelum memasang service key. Tidak ada `.env.local` produksi yang disalin ke workspace ini. Semua variabel CAPI di `.env.example` kosong/false.

## Invarian implementasi

- Trigger SQL dan insert booking satu transaksi; tidak ada request network dalam SQL/form save.
- Enrollment untuk booking baru dan DP sejak aktivasi; setting change menahan antrean lama, tidak backfill/promote test.
- Snapshot persisten menyimpan value/time/event identity, tidak payload PII. Perubahan contact/program/pax/price/value/time/consent time menahan antrean belum terkirim. Payload dibentuk ulang setelah pemeriksaan lease dan data, bukan membaca harga master.
- `submission_id` stabil per draft dipakai sebagai ID closing sehingga retry draft yang sama menabrak primary key dan diminta cek riwayat. Booking baru yang sengaja dibuat dengan ID lain belum dapat dideteksi sebagai transaksi ekonomi yang sama secara pasti.
- Worker max3 event/run, lease5 menit, timeout request15 detik, max5 attempt. Hanya rate-limit rejection pasti yang dijadwalkan retry. Timeout/5xx/lease expired ditahan karena mungkin sudah diterima.
- accepted artinya bukti respons penerimaan teknis, bukan receipt atribusi. DB completion yang gagal menghasilkan completion_unknown; jangan kirim ulang tanpa rekonsiliasi.
- Ada batas race antara preflight dan request. Tidak ada jaminan exactly-once global; dedup Meta perlu kontrak terverifikasi.
- Fase1 action_source chat. Fase2 business_messaging adapter belum dibangun. Jangan menambahkan field ctwa_clid rekaan pada phase1.

## Cara melanjutkan

Jalankan checks sesuai VALIDATION. Isi H01–H04 dan H10 terlebih dahulu. Setelah route/account cocok, siapkan staging H05–H07. Jangan mengeksekusi instruksi deployment dari dokumen lama tanpa memeriksa hosting aktual; beberapa catatan menyebut auto-pull main/VPS. Produksi dapat memiliki perubahan lebih baru dari baseline, jadi bandingkan sebelum menerapkan patch.

Koreksi aturan baru harus memperbarui PRD + tests + handoff. Jangan mengubah semua report lama menjadi booking-value ROAS secara diam-diam. Matikan mode/worker untuk rollback operasional dan pertahankan riwayat accepted.
