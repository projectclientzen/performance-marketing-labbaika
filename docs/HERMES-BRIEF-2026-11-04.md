# Brief Hermes — Labbaika Purchase CAPI, putaran 4 November 2026

**Dari:** Claude Code (atas permintaan Maszen) · **Untuk:** Hermes · **Pemilik keputusan:** Maszen

Dokumen ini melanjutkan `HERMES-START.md` dan `hermes-capi-handoff.md`; keduanya tetap berlaku. Yang di sini: apa yang berubah, apa yang sekarang menunggu kamu, urutan kerja, dan bukti yang harus diserahkan. Tidak ada secret di dokumen ini, dan jangan menambahkannya.

## 1. Status kode sekarang

- Repo `projectclientzen/performance-marketing-labbaika`, branch **`codex/labbaika-capi-booking-value`** (bukan `main`). Baseline `048df937`. Commit: `d72cf72` (kerja Codex fase 1) + commit audit Claude Code di atasnya.
- Fase 1 kode **selesai lokal**: tests 148/148, SQL 21/21 (33 migrasi), build lulus, rollback/reapply 032 lulus — rincian `VALIDATION-CAPI.md`. Belum ada staging, belum ada event Meta, belum ada data September.
- Diperbaiki minggu ini (lihat `CAPI-TASKS.md` C22–C25):
  - Booking yang dibatalkan saat event sedang dikirim tidak lagi menghapus bukti penerimaan Meta.
  - Booking yang dikoreksi setelah insert kini masuk antrean (satu kali).
  - Monitor owner `/owner/capi` kini punya: **heartbeat worker** (tiap run tercatat di `capi_worker_runs`), **coverage** booking yang tidak masuk antrean beserta alasannya, dan **rekonsiliasi** event `held` (tanpa kirim ulang). Perubahan mode/dataset diaudit dengan aktor.

## 2. ⚠️ Larangan keras putaran ini

1. **Jangan jalankan `scripts/apply-migrations.sh` ke database produksi dari branch ini.** Script itu menjalankan *semua* file `supabase/migrations/0*.sql`, jadi 032 ikut terpasang ke produksi. Migrasi 032 hanya ke **staging/database test** sampai Maszen menyetujui pilot. Untuk produksi, tetap dari `main`. Kapan pun 032 dipasang (staging maupun nanti produksi), jalankan dulu `scripts/capi-preflight-032.sql` — tidak menyimpan apa pun, dan berhenti dengan error bila DB target belum sampai 031, view CS pernah diubah manual, atau ada sisa objek `capi_*` dari tempelan SQL Editor.
2. **Urutan wajib kalau PR #2 nanti di-merge:** backup → preflight → pasang 032 di produksi → baru merge ke `main`. Kebalikannya membuat form closing error saat CS mengisi waktu DP (kolom belum ada).
3. **Jangan merge/push ke `main`.** Catatan lama menyebut VPS (`/opt/labbaika-reporting`) menarik `main` untuk deploy. Verifikasi dulu (tugas A1).
4. Jangan set `META_CAPI_ROUTE_VERIFIED=true` atau `META_CAPI_ALLOW_LIVE=true` di lingkungan mana pun sebelum A2 terbukti dan Maszen setuju. Mode produksi tetap `off`.
5. Jangan kirim event dengan `event_time` digeser ke hari ini, jangan backfill September, jangan buat `ctwa_clid` dari nomor/campaign/fbclid.
6. Jangan tempel token, nomor/email pelanggan, hash, full click ID, atau isi chat di chat, PR, log, atau dokumen.

## 3. Tugas, urutan, dan definisi selesai

| # | Tugas | Selesai bila kamu menyerahkan |
|---|---|---|
| **A1** | **Fakta deployment.** Host app produksi, apakah auto-pull `main`, cara build/restart, scheduler yang tersedia (cron/systemd/eksternal), lokasi backup DB, cara rollback | Tabel fakta + bukti (perintah/konfigurasi yang dilihat, tanpa secret) |
| **A2** | **Kontrak Meta untuk route generic chat** (`action_source=chat`): versi Graph API yang didukung, field wajib, dukungan `test_event_code`, batas umur event, aturan dedup `event_id`, batasan kategori data untuk perjalanan ibadah | Matriks per poin + link dokumentasi + tanggal dicek. Nilai untuk `META_CAPI_API_VERSION` dan `META_CAPI_MAX_EVENT_AGE_SECONDS` yang kamu rekomendasikan beserta alasannya |
| **A3** | **Inventaris aset**: Business Portfolio, ad account, Page, dataset/pixel, app, WABA, nomor CS — pemilik dan izin masing-masing; siapa yang bisa membuat system-user token untuk dataset | Matriks aset + izin; ID boleh, token tidak |
| **A4** | **Jalur WhatsApp resmi** (fase 2, riset saja): kelayakan Coexistence untuk nomor CS sekarang, atau opsi provider/nomor terpisah, biaya, dampak ke kerja CS | Opsi nyata + rekomendasi; **jangan memindahkan nomor** sebelum dibahas dengan Maszen |
| **A5** | **Data September**: export closing September (pastikan tahunnya), cohort berdasarkan `closing_date` *atau* pembayaran pertama (pilih satu, tulis), konversi ke JSON/CSV sesuai `capi-trial-plan.md`, jalankan `npm run capi:trial -- <file privat>` | Output agregat CLI + rekonsiliasi jumlah/nilai sebelum-sesudah konversi. File asli tetap di luar Git |
| **A6** | **Staging** (setelah A1–A3): project Supabase staging/test terpisah dari produksi, backup, lalu **`psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/capi-preflight-032.sql` harus exit 0** sebelum `apply-migrations.sh` ke staging. Env CAPI dari `.env.example` (dataset **test**), deploy branch ke staging. Scheduler tiap 5 menit pakai `scripts/capi-worker-tick.sh` (petunjuk cron di kepala file; secret di file env mode 600, tidak di crontab) | Output preflight, URL staging, migrasi 001–032 lulus, heartbeat muncul di `/owner/capi`, log tick `http=200` |
| **A7** | **UAT staging** — checklist §4 | Checklist terisi, dengan screenshot tanpa PII |
| **A8** | **Test Events Meta**: satu booking uji baru (data sintetis, waktu DP nyata saat itu) di mode `test` | Event terlihat di Test Events dengan value & currency benar; respons Meta dicatat tersamarkan |
| **A9** | **Runbook rekonsiliasi** event `held`: cara mencari `event_id` (`labbaika:booking:<uuid>:purchase:v1`, di test berprefiks `test:integration:`) di Events Manager/diagnostik, bukti apa yang cukup untuk "diterima" vs "tidak diterima", siapa yang memutuskan | Prosedur 1 halaman. Ini yang dipakai owner saat menekan "Rekonsiliasi" di monitor |

A4 dan A5 boleh paralel dengan A1–A3. A6–A9 menunggu A1–A3. Pilot produksi **bukan** bagian putaran ini — siapkan usulan saja setelah A8.

## 4. Checklist UAT staging (A7)

- [ ] Login owner, advertiser, CS, HRD. HRD **tidak** bisa membuka pengaturan/monitor CAPI; CS hanya melihat status booking miliknya.
- [ ] Mode `off` → booking baru tidak membuat event. Mode `dry_run` → event "Simulasi tersimpan", worker tidak mengirim.
- [ ] Mode `test`: booking baru Rp30 jt × 2 pax, DP Rp10 jt, waktu DP diisi → **satu** event bernilai **Rp60 jt**. Input cicilan berikutnya → tetap satu event.
- [ ] Booking tanpa waktu DP / tanpa consent → tidak masuk antrean dan muncul di panel "Booking yang tidak masuk antrean" dengan alasan yang benar.
- [ ] Batalkan booking saat event masih `pending` → `Dihentikan`. Ubah nilai/email saat `pending` → `Perlu diperiksa`.
- [ ] Rekonsiliasi satu event `held` dengan catatan → status berubah, tercatat di Audit Log dengan nama aktor. Catatan < 10 karakter ditolak.
- [ ] Ganti mode/dataset → tercatat di Audit Log dengan aktor; antrean lama jadi `Perlu diperiksa`, tidak dipromosikan.
- [ ] Panggil worker **dua kali bersamaan** (dua proses) → tidak ada event yang terkirim dua kali.
- [ ] Hentikan scheduler 15+ menit → monitor menampilkan peringatan worker tidak jalan.
- [ ] Simulasikan timeout jaringan (mis. blokir egress sementara) → event `held` "Hasil kirim belum pasti", **tidak** di-retry otomatis.
- [ ] Rollback operasional: set mode `off`, stop scheduler → tidak ada request keluar; riwayat event tetap ada.

## 5. Format laporan balik

Satu dokumen `docs/HERMES-FINDINGS-<tanggal>.md` di branch yang sama (atau kirim ke Maszen), berisi: tugas A1–A9 dengan status **selesai / terblokir (alasan) / belum**, bukti per tugas, sumber + tanggal dokumentasi Meta, commit/lingkungan yang diuji. Pisahkan istilah: *selesai lokal*, *selesai staging*, *diterima Meta*, *teratribusi*, *dipakai optimasi*. Hal yang tidak bisa dibuktikan ditulis sebagai belum terbukti — jangan diisi asumsi.

Setelah laporan ini, Claude Code melanjutkan: penyesuaian kode bila kontrak A2 berbeda dari asumsi, lalu fase 2 (webhook referral) bila A4 menghasilkan jalur resmi.
