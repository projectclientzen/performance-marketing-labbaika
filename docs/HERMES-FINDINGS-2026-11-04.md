# Hermes Findings — Labbaika Purchase CAPI (putaran 4 November 2026)

Tanggal kerja: 2026-11-04 (WIB). Dikerjakan Hermes di host VPS `/opt/labbaika-reporting`.
Branch ditinjau: `codex/labbaika-capi-booking-value` @ `c87f5b9` (remote), baseline `048df937` (yang terpasang di produksi).
Dokumen ini TIDAK berisi secret/token/hash/PII.

---

## Ringkasan status

| # | Tugas | Status |
|---|---|---|
| A1 | Fakta deployment | **Selesai** |
| A3 | Inventaris aset Meta | **Selesai (sebagian besar; ada 2 blocker akses)** |
| A5 | Data September + trial | **Terblokir** (tidak ada data September di DB produksi; export/Excel belum ada) |
| A2 | Kontrak Meta generic chat | **Selesai (riset + rekomendasi nilai)** |
| A4 | Jalur WhatsApp resmi | **Selesai (riset)** |
| A9 | Runbook rekonsiliasi `held` | **Selesai (draft 1 halaman)** |
| A6–A8 | Staging + UAT + Test Events | **Belum** (menunggu keputusan staging & dataset) |

---

## A1 — Fakta deployment

| Aspek | Fakta | Bukti |
|---|---|---|
| Host produksi | VPS Linux, `/opt/labbaika-reporting`, branch `main` @ `048df937` | `git rev-parse HEAD` |
| Runtime | Next.js standalone, Node v22.23.1 (`/root/.hermes/node/bin/node`) | `node --version` |
| Service | systemd `labbaika-reporting.service`, `Restart=on-failure`, `PORT=3003`, env dari `.env.production` (file 600) | `systemctl cat` |
| Status service | **active**, health 200, `supabase_reachable:true, query_ok:true` | `curl /api/health` |
| Reverse proxy | nginx `labbaika-reporting` (hanya listen 80; TLS di Cloudflare Flexible) | `/etc/nginx/sites-available/labbaika-reporting` |
| Auto-pull | **Ya, tapi hanya `origin/main`.** Hermes cron `b5b6d25aa7c4` tiap 15 menit → `deploy_labbaika.py`: fetch main → reset --hard → npm ci → build → salin `public`+`.next/static` → restart → health check | cron list + script |
| Dampak ke branch CAPI | **Tidak ada risiko auto-deploy CAPI** selama perubahan tidak di-merge ke `main`. State deploy terakhir `048df937` = baseline. | `/root/.hermes/state/labbaika-deploy.json` |
| Scheduler tersedia | Hermes cron (no_agent scripts) + crontab sistem. Tidak ada systemd timer untuk app ini. | `cronjob list`, `crontab -l` |
| Backup DB | Harian 02:00 WIB → pg_dump `-Fc` → Cloudflare R2 (`ngajigaes/labbaika-reporting/backups/db-YYYYMMDD.dump`), retensi 14 hari. **15 backup ada (20 Okt – 3 Nov), ukuran konsisten 594.868 B** | state + list R2 |
| Rollback | (1) Service: `git reset --hard <sha>` + build + restart via `deploy_labbaika.py`; (2) DB: restore `.dump` dari R2 via `pg_restore`. `.env.production` gitignored, tidak tersentuh reset. | script deploy + backup |

**Perhatian (untuk A6):**
- `scripts/apply-migrations.sh` ADA di `main` dan menjalankan semua `supabase/migrations/0*.sql` — **konfirmasi larangan brief: jangan pernah menjalankannya ke DB produksi dari branch CAPI** (032 akan ikut terpasang). Preflight `scripts/capi-preflight-032.sql` hanya ada di branch CAPI.
- Migrasi di produksi saat ini berhenti di `031`; 032 belum terpasang. Kolom `closings` produksi = 36 kolom, **belum ada `first_payment_received_at`** (sesuai perkiraan — kolom itu datang dari 032).

---

## A3 — Inventaris aset Meta

Token yang dipakai untuk inspeksi: system/user token milik app **`936342762812978` — "AI AGEN Labbaika"** (terlihat sebagai user `LABBAIKA PA`, id `122104485111396912`). Semua panggilan Graph API yang berhasil: `v19.0–v26.0` (token valid di semua versi yang dicoba).

| Aset | Nilai | Bukti/akses |
|---|---|---|
| Ad Account | `act_2631246970383085` — **"MJO - Labbaika Group HKM - 2"**, status 1 (aktif), IDR, Asia/Jakarta | `GET /me/adaccounts` OK |
| Business | `2212766145610961` — **"Kantor MJO Labs"** | field `business` ad account OK |
| App | `936342762812978` — **"AI AGEN Labbaika"** | `GET /{app}` OK (info lanjut butuh app token) |
| Page | `100975942824856` — **"Labbaika Travel"** (kategori Product/service) | `GET /me/accounts` OK |
| Dataset / pixel | **Belum ada** di ad account: `GET /act_.../adspixels` → `(#100) Missing Permission`. Dataset CAPI juga belum ada (`GET /{page}/dataset` → `(#200) App does not have page_events permission on the Page`) | error terekam |
| WABA | **Belum bisa dibaca**: `GET /{BM}/owned_whatsapp_business_accounts` → `(#200) permission` | error terekam |
| System users BM | **Belum bisa dibaca**: `GET /{BM}/system_users` → butuh `VIEW_SYSTEM_USERS` | error terekam |
| Owned pages/accounts BM | `owned_pages`, `owned_ad_accounts`, `client_ad_accounts` → **kosong** untuk token ini | `data: []` |

**Kesimpulan A3:** Aset inti (ad account + Page + BM + app) sudah teridentifikasi. Yang **belum bisa** dibuktikan oleh token saat ini:
1. **Dataset (pixel/CAPI)** untuk Labbaika — tidak terlihat, dan `page_events` belum granted ke app di Page.
2. **WABA + nomor CS** — butuh izin `whatsapp_business_management`.
3. **Siapa yang bisa membuat system-user token** untuk dataset — butuh `VIEW_SYSTEM_USERS` (admin BM "Kantor MJO Labs" yang pegang).

Untuk A6–A8 dibutuhkan: dataset test Labbaika (atau dibuat via `POST /{PAGE_ID}/dataset` setelah `page_events` granted) + token dengan `business_management`/`ads_management`/`page_events` (route generic chat).

Catatan penting route: panggilan `/me/adspixels` di token ini menembak dataset akun iklan — **tidak ada pixel**. Pixel web yang terpasang di `labbaikatravel.id` adalah **`1970649077141329`** (bukan milik akun `2631246970383085` ini; terpasang via GTM-NZ7TSLQR). Pixel `1377322622892006` / `4572962509606483` dari memory adalah aset NgajiGaes/2B, **bukan Labbaika**.

---

## A2 — Kontrak Meta: generic chat (`action_source=chat`)

Sumber: Meta for Developers, diakses 4 Nov 2026.
- Server Event Parameters: https://developers.facebook.com/documentation/ads-commerce/conversions-api/parameters/server-event/
- Using the API: https://developers.facebook.com/documentation/ads-commerce/conversions-api/using-the-api/
- Business Messaging (untuk pembanding `business_messaging`): https://developers.facebook.com/documentation/ads-commerce/conversions-api/business-messaging/

| Poin | Temuan |
|---|---|
| Nilai `action_source` | **`chat` valid** ("Conversion was made via a messaging app, SMS, or online messaging feature"). Berbeda dari `business_messaging` yang khusus ads-that-click-to-Messenger/WA/IG. Semua action source mengaktifkan measurement + custom audience + optimization. |
| Field wajib (non-web) | `event_name`, `event_time`, `user_data`, `action_source`. Non-web event **tidak** wajib `event_source_url`/`client_user_agent` (wajib hanya untuk `website`). `custom_data` optional, tapi untuk Purchase value wajib diisi `custom_data.value` + `currency`. |
| `event_id` | Optional tapi direkomendasikan; string bebas. Dedup browser↔server memakai pasangan `event_name`+`event_id` dalam jendela 48 jam. |
| **Batas umur event** | **`event_time` maksimal 7 hari sebelum waktu kirim (GMT).** Jika ada satu saja event >7 hari, **seluruh request ditolak dan tidak ada event diproses.** → rekomendasi `META_CAPI_MAX_EVENT_AGE_SECONDS=604800`. |
| `test_event_code` | Didukung (`POST /{DATASET_ID}/events` dengan field `test_event_code`). Event test tetap masuk Events Manager (Test Events) dan tidak mencemari data produksi. |
| Versi API | Token valid `v19.0`–`v26.0`. Kode CAPI dibangun tanpa pin versi (harus diisi eksplisit). **Rekomendasi `META_CAPI_API_VERSION=v21.0`** (sama dengan yang dipakai sinkronisasi Ads Labbaika yang sudah jalan, stabil, dan masih jauh dari sunset). |
| Dedup/atribusi | `accepted` ≠ `attributed`. Generic chat **tidak otomatis teratribusi ke CTWA**; tanpa `ctwa_clid`, Meta mencoba match lewat `user_data` (em/ph/fn/ln/ct/st/zp/country/ge/db) — match **tidak dijamin**. |
| Kategori data terbatas | Meta membatasi data health/finansial per **data source** (bukan per route). Untuk perjalanan ibadah: payload Labbaika hanya kirim `Purchase` + value + hash kontak minimal (no nama paket, no itinerary, no data kesehatan) — ini konsisten dengan aturan. Tidak boleh "menyembunyikan" kategori lewat generic event. |
| Endpoint | `POST https://graph.facebook.com/v{VERSION}/{DATASET_ID}/events` |

Rekomendasi nilai:
- `META_CAPI_API_VERSION=v21.0`
- `META_CAPI_MAX_EVENT_AGE_SECONDS=604800` (7 hari)

---

## A4 — Jalur WhatsApp resmi (riset)

Fakta saat ini: CS memakai **WhatsApp Business app HP/Web** (tidak ada Cloud API/webhook). Nomor CS (dari copy ads): Reza `082146054673`, Achril `082146054672`, Alif `085333392755`.

Dari dokumen resmi Meta (Business Messaging onboarding, 4 Nov 2026):
- `business_messaging` + `ctwa_clid` HANYA bisa lewat integrasi resmi: **Cloud API (recommended)** atau On-Premises API (yang sedang di-sunset, versi final berakhir Okt 2025). `ctwa_clid` muncul di `messages[].referral.ctwa_clid` webhook.
- Tanpa `ctwa_clid`, path "send events without ctwa_clid" memakai `user_data` (hashed) + wajib `page_id` — **match tidak dijamin dan cakupan lebih sempit**.
- **Coexistence** (nomor yang sama tetap dipakai di app HP/Web sambil menerima webhook Cloud API) tidak dijamin untuk semua nomor/region — **eligibility wajib dicek langsung per nomor**; dokumen Meta tidak menjamin. Saat ini belum ada bukti onboarding Cloud API/Coexistence untuk ketiga nomor.

Opsi nyata:
1. **Onboarding Cloud API resmi (nomor yang sama atau nomor terpisah)** → dapat `ctwa_clid` asli. Dampak ke HP/Web CS dan biaya wajib dibahas. Tidak boleh memindahkan nomor tanpa keputusan Maszen.
2. **BSP/Tech Provider resmi** yang meneruskan `referral.ctwa_clid` (mis. lewat provider yang sudah dipakai tim) → perlu verifikasi dukungan referral.
3. **Tetap app saat ini (fase 1 generic chat)** → kirim `Purchase` via `action_source=chat` dengan `user_data` hashed; **tanpa klaim atribusi CTWA**. Ini yang konsisten dengan kode fase 1.

Rekomendasi: jalan dengan **opsi 3 dulu** (sesuai PRD), dan A4 menjadi "butuh keputusan + verifikasi eligibility" sebelum fase 2.

---

## A5 — Data September + trial offline

Status: **TERBLOKIR — tidak ada data.**

- DB produksi (`closings`) hanya berisi **3 baris**, semuanya `closing_date` Agustus 2026 (04 & 24 Agustus). **Nol baris September 2026.**
  - `3fc964d5…` 04/08, dp, paid 34jt, pax 2, price 41,9jt, total 83,8jt
  - `5f5dc12d…` 24/08, dp, paid 10jt, pax 2, price 32,9jt, total 65,8jt
  - `4b2b7374…` 24/08, dp, paid 10jt, pax 2, price 32,9jt, total 65,8jt
- File export September (Excel/JSON/CSV) **tidak ditemukan** di `/root`, `/opt`, `/root/.hermes/cache`.
- Kolom `first_payment_received_at` belum ada di skema produksi (datang dari migrasi 032) — trial offline (CLI, tanpa DB) tetap bisa dijalankan nanti karena parser membaca JSON/CSV.

Yang dibutuhkan dari Maszen/CS: **export closing September 2026** (satu baris per booking, kolom sesuai `capi-trial-plan.md`), atau izin sumber export. Setelah itu: konversi → `npm run capi:trial -- <file privat>` → rekonsiliasi agregat.

---

## A9 — Runbook rekonsiliasi event `held` (draft)

**Kapan dipakai:** event di monitor berstatus `held` = "Hasil kirim belum pasti" (timeout / 5xx / lease expired). Jangan kirim ulang otomatis.

1. Cari `event_id` di monitor `/owner/capi`: produksi `labbaika:booking:<closing_uuid>:purchase:v1`; test `test:integration:<...>`.
2. Buka **Events Manager** → pilih dataset yang sama dengan `META_CAPI_DATASET_ID` → cari event dengan `event_id` tersebut (atau filter `event_name=Purchase` + waktu sekitar `event_time`).
3. **Bukti "diterima"**: event tampil di Events Manager dengan value & currency benar (nilai total booking, IDR).
   - Jika ADA → status bisa diubah jadi `accepted` (catat `accepted_after_booking_change` bila booking berubah saat pengiriman). **Jangan** kirim ulang.
   - Jika TIDAK ADA setelah ditunggu (mis. 24 jam) → boleh `failed` (retry terbatas) **hanya jika** `event_time` masih dalam 7 hari dan alasan kegagalan adalah rate-limit/penolakan pasti.
4. Rekonsiliasi dicatat di monitor dengan catatan ≥10 karakter; aktor terekam otomatis di Audit Log.
5. Pemutus: **Maszen / owner** yang menekan "Rekonsiliasi". Hermes menyiapkan bukti, tidak memutuskan sendiri.
6. Event test (`test:integration:*`) tidak boleh dipromosikan ke produksi.

---

## A6–A8 — Staging + UAT + Test Events

**Belum dikerjakan.** Prasyarat yang belum terpenuhi:
1. Keputusan lingkungan staging (project Supabase terpisah vs database test disposable di VPS).
2. Dataset test Labbaika + token dengan izin `page_events`/`business_management` (A3 blocker).
3. Export September tidak menghalangi A6–A8 (data sintetis untuk test events).

Urutan saat disetujui: backup → preflight 032 (exit 0) → pasang 032 di staging → deploy branch ke staging → scheduler `capi-worker-tick.sh` tiap 5 menit → UAT checklist → Test Events.
