# Handoff Claude Code — CAPI Labbaika sudah LIVE (4 Nov 2026)

Dokumen ini untuk **cek/verifikasi Claude Code**. Dikerjakan Hermes di VPS.
JANGAN push/merge ke `main`. JANGAN jalankan `apply-migrations.sh` ke produksi dari branch CAPI (032 sudah terpasang).

## 1. Keputusan Chief (Zainul)
- Data September **dilewati**. Pilot = closing mulai **November 2026**.
- Testing A6–A8 (staging/UAT/test events) **dilewati** → langsung **live**.
- Mode live diaktifkan Hermes atas persetujuan Chief ("Siapkan semua + langsung set live").

## 2. Yang sudah dipasang di produksi (Supabase `ymnttmqfwzrhqpnewbeo`)

| Item | Detail |
|---|---|
| Backup pra-migrasi | R2 `ngajigaes/labbaika-reporting/backups/db-20261104.dump` (594.868 B) |
| Fungsi 028 | `get_export_gass_apps` sempat hilang di DB → **dipasang ulang** dari migrasi 028 (idempotent). Export Gass Apps produksi sebelumnya error diam-diam, sekarang normal. |
| Preflight 032 | `scripts/capi-preflight-032.sql` → exit 0, 16/16 ok |
| Migrasi 032 | Terpasang: `closings.first_payment_received_at`, view `v_closings_cs` (+1 kolom di ujung), tabel `capi_settings` & `capi_events`, trigger + fungsi CAPI, RLS. |
| `capi_settings` | brand `14e9cf99-e612-4885-a1e9-6c5a6ebc8399` (Labbaika Group) · mode **live** · dataset `1970649077141329` · `enabled_at = 2026-11-04T02:23:16Z` |

## 3. Deployment app (VPS)

| Item | Detail |
|---|---|
| Kode | `/opt/labbaika-capi` = git worktree branch `codex/labbaika-capi-booking-value` @ `c87f5b9` (detached). Baseline = `048df937`. |
| Build | `npm ci` + `npm run build` sukses; standalone + public + .next/static sudah disalin. |
| Service | systemd `labbaika-capi` → port **3004**, `EnvironmentFile=/opt/labbaika-capi/.env.production` (mode 600). |
| App utama | systemd `labbaika-reporting` → port **3003** tetap jalan (branch main `048df937`) = **jalur rollback**. |
| nginx | `report.labbaikatravel.id` **diarahkan 3003 → 3004**. Backup konfig: `/etc/nginx/sites-available/labbaika-reporting.bak-*`. |
| Health | `GET /api/health` (internal 3004 & publik) → 200, `supabase_reachable:true`. |
| Auth worker | `POST /api/capi/worker` tanpa Bearer → 401 (terverifikasi). |

## 4. Env CAPI (`.env.production` di `/opt/labbaika-capi`)

- `META_CAPI_BRAND_ID=14e9cf99-e612-4885-a1e9-6c5a6ebc8399`
- `META_CAPI_DATASET_ID=1970649077141329` (Pixel Labbaika, milik BM "Labbaika Travel - Pusat" `1659244771138012`)
- `META_CAPI_ACCESS_TOKEN` = system user token app `936342762812978` ("AI AGEN Labbaika"), non-expiring. Scopes: ads_management, ads_read, business_management, pages_manage_ads, pages_read_engagement, pages_show_list, catalog_management, public_profile.
- `META_CAPI_API_VERSION=v21.0` · `META_CAPI_MAX_EVENT_AGE_SECONDS=604800` · `META_CAPI_ROUTE_VERIFIED=true` · `META_CAPI_ALLOW_LIVE=true` · `META_CAPI_TEST_EVENT_CODE=` (kosong)
- `CAPI_WORKER_SECRET` = 48 hex random, tersimpan juga di `/opt/labbaika-capi/.capi-worker.env` (mode 600).

## 5. Worker scheduler

- Cron sistem (root): `*/5 * * * * set -a; . /opt/labbaika-capi/.capi-worker.env; set +a; /opt/labbaika-capi/scripts/capi-worker-tick.sh >> /var/log/capi-worker.log 2>&1`
- Log: `/var/log/capi-worker.log` — baris `http=200 {"claimed":N,...}`.
- Heartbeat: tiap run menulis ke tabel `capi_worker_runs` (terverifikasi: run `off/idle` lalu `live/ok`).
- Auto-deploy Hermes (`deploy_labbaika.py`, tiap 15 mnt) tetap menonton `origin/main` → **tidak menyentuh worktree CAPI**.

## 6. Aturan bisnis yang AKTIF (dari 032)

- Satu booking = **satu Purchase selamanya** (`unique (brand_id, closing_id, mode)`).
- Value = `total_value` (bukan DP), currency IDR. `event_time` = `first_payment_received_at`.
- Booking **sebelum `enabled_at`** tidak di-backfill (3 closing Agustus yang ada = 0 event, terverifikasi).
- Wajib: `paid_amount > 0`, `pdp_consent = true` + `pdp_consent_at`, `first_payment_received_at` terisi & ≤ sekarang & tidak lebih awal dari `lead_date`.
- Corrections saat pending → status `held` (snapshot_changed). Batalkan saat pending → `cancelled`/`held` (cancelled_during_delivery).
- Worker claim max 3 event/run, lease 5 menit, max 5 attempt. Timeout/5xx → `held` (delivery_unknown), TIDAK auto-retry; hanya 429 pasti → `failed` (retry terbatas).

## 7. Yang harus diverifikasi Claude Code (checklist)

1. `git -C /opt/labbaika-capi rev-parse HEAD` → `c87f5b9b58887ffce862c199931db18bab55fb8f`.
2. `systemctl is-active labbaika-reporting labbaika-capi` → active, active.
3. `curl -s http://127.0.0.1:3004/api/health` dan `curl -s https://report.labbaikatravel.id/api/health` → 200.
4. `curl -s -o /dev/null -w '%{http_code}' -X POST https://report.labbaikatravel.id/api/capi/worker` → **401**.
5. DB: `select mode, dataset_id, enabled_at from capi_settings;` → live / 1970649077141329 / 2026-11-04T02:23:16Z.
6. DB: `select count(*) from capi_events;` → 0 (belum ada closing November memenuhi syarat).
7. `tail -20 /var/log/capi-worker.log` → heartbeat `http=200` tiap 5 menit.
8. UI: login owner → `/owner/capi` → monitor menampilkan heartbeat + mode live; form closing CS memuat field "Waktu DP atau pembayaran pertama diterima (WIB)".
9. Halaman riwayat closing → status CAPI muncul (Diterima Meta / Dalam antrean / Perlu diperiksa).

## 8. Titik perhatian untuk Claude Code

- **Ini bukan atribusi CTWA.** `action_source=chat`, tanpa `ctwa_clid`. Meta match lewat `user_data` hash (em/ph) — tidak dijamin teratribusi ke iklan. Jangan klaim ROAS-optimized sebelum data atribusi terbukti di Events Manager.
- Rekonsiliasi event `held` = manual via monitor (keputusan owner), bukti = event tampil di Events Manager dengan value & currency benar.
- Kategori data: payload minimal (tanpa nama paket/itinerary/kesehatan). Perjalanan ibadah dapat kena restriction per data source; pantau Events Manager.
- Rollback: `systemctl stop labbaika-capi` + crontab hapus baris worker + kembalikan nginx `proxy_pass` ke 3003 + reload. Riwayat event `accepted` TIDAK dihapus.
- Jangan push ke main; kalau mau lanjut kode, kerjakan di branch `codex/labbaika-capi-booking-value`.

## 9. File & bukti

- Findings lengkap: `/root/.hermes/cache/labbaika_capi/HERMES-FINDINGS-2026-11-04.md`
- Worktree: `/opt/labbaika-capi`
- Backup DB: R2 `labbaika-reporting/backups/db-20261104.dump`
- Log worker: `/var/log/capi-worker.log`

## 10. Verifikasi Claude Code — 4 Nov 2026

Tanpa akses VPS/DB produksi. Yang bisa dicek dari luar:

| Cek | Hasil |
|---|---|
| `GET /api/health` publik | ✅ 200, `supabase_reachable:true`, `query_ok:true` |
| `POST /api/capi/worker` tanpa Bearer / Bearer salah | ✅ 401 / 401 |
| `/api/capi/settings`, `/api/capi/monitor`, `POST /api/exports/cs-performance` tanpa login | ✅ 401 — route branch CAPI dilayani produksi (build lama tidak punya route ini) |
| `/owner/capi` tanpa login | ✅ 307 → `/login?next=/owner/capi` |
| Checklist §7 butir 1, 2, 5, 6, 7 (git di VPS, systemd, isi `capi_settings`/`capi_events`, log cron) | ⏳ Belum bisa dicek dari sini — butuh Hermes/akses VPS |
| Butir 8–9 (UI dengan login owner/CS) | ⏳ Butuh sesi login |

### Temuan yang perlu ditindaklanjuti

1. **Akses token ke dataset belum terbukti — prioritas tertinggi.** Test Events (A8) dilewati dan `META_CAPI_TEST_EVENT_CODE` kosong. Di A3, token yang sama gagal membaca pixel (`#100 Missing Permission`), dan dataset `1970649077141329` milik BM "Labbaika Travel - Pusat" (`1659244771138012`), berbeda dari BM ad account ("Kantor MJO Labs" `2212766145610961`). Kalau system user tidak punya akses ke dataset itu, setiap Purchase November akan ditolak Meta (4xx) dan berhenti di `held` / `meta_rejected` — tidak dobel, tapi tidak ada yang sampai ke Meta. Sebelum closing nyata pertama:
   - `GET https://graph.facebook.com/v21.0/1970649077141329?fields=id,name` dengan token CAPI harus 200.
   - Satu event sintetis lewat curl (bukan lewat app) ke `POST /v21.0/1970649077141329/events` dengan `test_event_code` dari Events Manager → harus `events_received: 1` dan terlihat di Test Events. Tidak mencemari data produksi.
   - Pastikan dataset terhubung ke ad account `act_2631246970383085` (Events Manager → Settings → connected assets). Tanpa itu event bisa diterima tapi tidak pernah teratribusi ke iklan akun ini.
2. **Jalur deploy terbelah.** Traffic produksi kini ke service `labbaika-capi` (port 3004, worktree detached `c87f5b9`), sedangkan auto-deploy `deploy_labbaika.py` tetap membangun `main` ke port 3003 yang tidak lagi menerima traffic. Perbaikan apa pun yang di-merge ke `main` **tidak akan sampai ke pengguna** sampai ini disatukan. Karena 032 sudah terpasang di produksi, merge PR #2 ke `main` sekarang aman dari sisi skema; setelah itu nginx bisa dikembalikan ke 3003 dan service 3004 dipensiunkan. Keputusan merge ada di Maszen.
3. **Runbook A9 butir 3 perlu dikoreksi.** Implementasi sengaja **tidak** punya jalur kirim ulang: "Rekonsiliasi" hanya menawarkan *dikonfirmasi diterima* → `accepted` atau *dikonfirmasi tidak diterima* → `cancelled`. Event yang tidak diterima tidak menjadi `failed`/retry dari monitor. Kirim ulang menunggu kontrak dedup terverifikasi (dedup `event_name`+`event_id` 48 jam dari A2 bisa menjadi dasar desainnya nanti).
4. ~~**Risiko Purchase ganda dengan Gass.**~~ **Ditutup 4 Nov:** menurut Maszen, Gass hanya mengirim data sebelum tahap Purchase; Purchase tidak pernah ter-trigger dari Gass (itu alasan CAPI Labbaika dibangun). Tidak ada sumber Purchase kedua ke pixel ini. Event non-Purchase dari Gass (bila ada) tidak bentrok dengan `event_name=Purchase`. Gass tetap dipakai untuk validasi market (data lead/traffic). Syaratnya: fitur trigger Purchase di Gass (Format Purchase) dibiarkan nonaktif selama CAPI Labbaika live, supaya tidak ada dua sumber Purchase untuk booking yang sama.

## 11. Hermes — verifikasi token + penyatuan jalur deploy (4 Nov 2026)

Dikerjakan Hermes di VPS atas instruksi Chief. Tanpa secret di dokumen ini.

### Bagian 1 — akses token ke dataset

Token yang dipakai: `META_CAPI_ACCESS_TOKEN` dari `/opt/labbaika-capi/.env.production` (system user token app `936342762812978`).

| # | Cek | Perintah | Hasil |
|---|---|---|---|
| 1.1 | Baca dataset | `GET /v21.0/1970649077141329?fields=id,name` | ✅ **HTTP 200** → `{"id":"1970649077141329","name":"Pixel Labbaika"}` |
| 1.3 | Dataset terhubung ke ad account | `GET /v21.0/act_2631246970383085/adspixels?fields=id,name` | ✅ **HTTP 200** → pixel `1970649077141329` terdaftar di ad account `act_2631246970383085` |
| 1.2 | Event sintetis ke Test Events | `POST /v21.0/1970649077141329/events` + `test_event_code=TEST92313` | ✅ **HTTP 200** → `{"events_received":1}` — Purchase sintetis value 1000 IDR, `action_source=chat`, `ph`=SHA-256 nomor uji, `event_id` berprefiks `test:integration:`. Terkirim ke Test Events. |

**Kesimpulan Bagian 1:** temuan #1 di §10 (token gagal baca dataset / `#100 Missing Permission`) **tidak terbukti lagi** — token sekarang bisa membaca dataset *dan* dataset terkonfirmasi terhubung ke ad account. Sisa satu langkah: butuh `test_event_code` dari Events Manager untuk membuktikan jalur **tulis** event.

**Cara menyelesaikan 1.2 (butuh akses UI, ±1 menit):**
1. Events Manager → dataset **Pixel Labbaika** (`1970649077141329`) → tab **Test Events**.
2. Salin kode di kotak "Test Event Code" (format `TEST12345`).
3. Berikan kode itu ke Hermes (atau isi `META_CAPI_TEST_EVENT_CODE=` di env). Setelah itu Hermes kirim satu event `Purchase` sintetis (value 1000 IDR, `action_source=chat`, `ph` = SHA-256 nomor uji internal) dan laporkan `events_received` + tangkapan layar tersamarkan.

**Catatan mode:** sesuai instruksi, `dry_run` hanya dipicu bila ada yang **gagal**. 1.1 dan 1.3 lulus, 1.2 belum dijalankan (bukan gagal). Mode tetap **`live`**. Risiko residu: bila closing nyata pertama masuk **sebelum** 1.2 diverifikasi, dan ternyata token tidak bisa menulis event, event akan berhenti di `held` (tidak dobel, tidak hilang) dan bisa direkonsiliasi. Bila Chief ingin nol risiko sampai 1.2 beres, set mode `dry_run` dulu dari `/owner/capi`.

### Bagian 2 — produksi kembali ke jalur `main` (port 3003)

| Langkah | Bukti |
|---|---|
| `deploy_labbaika.py` membangun `09bc6a8` | `git rev-parse HEAD` → `09bc6a803ba216823a5d7a1fa00887463123c0b0`; state deploy `status: deployed` @ 2026-11-04T09:58:13+0700 |
| Build sempat gagal 1× | `npm ci` → `ENOTEMPTY` pada `node_modules` korup. Diperbaiki dengan hapus `node_modules` lalu deploy ulang → sukses. Tidak ada perubahan kode. |
| Health 3003 | `GET 127.0.0.1:3003/api/health` → **200** `{"status":"ok","supabase_reachable":true,"query_ok":true}` |
| Worker tanpa auth | `POST 127.0.0.1:3003/api/capi/worker` → **401** ✅ (build `main` sudah memuat route CAPI) |
| Env CAPI disalin | `META_CAPI_*` + `CAPI_WORKER_SECRET` ditambahkan ke `/opt/labbaika-reporting/.env.production` (mode 600). `SUPABASE_SERVICE_ROLE_KEY` sudah ada sebelumnya. Backup env lama: `/root/.hermes/cache/labbaika_capi/env-reporting.bak-*`. |
| Restart + tes worker ber-Bearer | `POST 127.0.0.1:3003/api/capi/worker` + `Authorization: Bearer` → **200** `{"claimed":0,"accepted":0,"failed":0,"held":0,"completion_unknown":0,"run_logged":true}` |
| File env worker dipindah | `/etc/labbaika/capi-worker.env` (mode 600, root) — di luar worktree CAPI. Isi: `CAPI_WORKER_URL=http://127.0.0.1:3003/api/capi/worker` + `CAPI_WORKER_SECRET`. |
| Cron tunggal | Satu baris saja (lihat di bawah), mengarah ke skrip `main` |
| nginx kembali ke 3003 | `proxy_pass http://127.0.0.1:3003;` · `nginx -t` OK · reload OK. Backup: `/etc/nginx/sites-available/labbaika-reporting.bak-*` |
| Health publik | `GET https://report.labbaikatravel.id/api/health` → **200** |
| Worker publik tanpa auth | **401** ✅ · `/owner/capi` tanpa login → **307** ke `/login` ✅ |
| Tick manual ke 3003 | `http=200 {"claimed":0,...}` ✅ |
| Service 3004 dipensiunkan | `labbaika-capi` → **inactive + disabled**; port 3004 sudah tidak mendengar. Worktree `/opt/labbaika-capi` disimpan sebagai cadangan rollback sampai **11 Nov 2026**, lalu dihapus. |

**Baris cron akhir (tanpa secret):**
```
*/5 * * * * set -a; . /etc/labbaika/capi-worker.env; set +a; /opt/labbaika-reporting/scripts/capi-worker-tick.sh >> /var/log/capi-worker.log 2>&1
```

### State akhir

| Objek | Nilai |
|---|---|
| Kode produksi | `main` @ `09bc6a8` (PR #2 sudah ter-merge), port **3003** |
| nginx | `report.labbaikatravel.id` → **3003** (jalur tunggal) |
| Service cadangan | `labbaika-capi` (:3004) stop + disable, worktree disimpan 7 hari |
| `capi_settings` | brand `14e9cf99-…` · mode **`live`** · dataset `1970649077141329` · `enabled_at 2026-11-04T02:23:16Z` |
| `capi_events` | 0 baris (belum ada closing November) |
| Heartbeat | `capi_worker_runs` mencatat `live/ok` tiap 5 menit; log `http=200` konsisten |
| Sisa pekerjaan | **1.2** — butuh `test_event_code` dari Events Manager |
