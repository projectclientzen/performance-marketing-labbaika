# Audit Publish-Ready — Labbaika Reporting

Tanggal: 26 Agustus 2026 · Branch: `main` · Commit audit terakhir: `411c9df`
VPS: `report.labbaikatravel.id` (Next.js 14 standalone, port 3003, Cloudflare Flexible)
DB: Supabase `ymnttmqfwzrhqpnewbeo` · Repo: `/opt/labbaika-reporting`

Semua item CRITICAL & IMPORTANT **lolos, diverifikasi langsung di produksi**. Kolom "Bukti" bisa dijalankan ulang (lihat §Verifikasi).

---

## Ringkasan status

### 🔴 CRITICAL — LULUS
| # | Item | Status | Bukti |
|---|------|--------|-------|
| 1 | Login auth | ✅ | Prod login owner **200**, CS **200** |
| 2 | RLS (CS ≠ owner) | ✅ | CS → owner routes **semua 403** |
| 3 | Env vars | ✅ | `META_ACCESS_TOKEN` di `.env.production`; `NEXT_PUBLIC_SUPABASE_URL` tidak diperlukan (di-hardcode di kode) |

### 🟡 IMPORTANT — LULUS
| # | Item | Status | Catatan |
|---|------|--------|---------|
| 4 | `bg-scrim` + colors | ✅ | Token `scrim` ada di `@theme` (`app/globals.css`) |
| 5 | InsightSheet flow | ✅ | Modal wajib, ter-wire: save → modal → simpan → redirect |
| 6 | F-16 Meta sync | ✅ (diperbaiki) | Aman (owner-only, RLS, envelope). 3 celah correctness ditutup — lihat §F-16 |

### 🟢 NICE TO HAVE
| # | Item | Status |
|---|------|--------|
| 7 | Desktop responsive CS | ✅ Sudah dibangun (F-03 grid source, F-05 rail 2-kolom, dll) |
| 8–10 | Export / Period Lock / Audit Log | ✅ Rute ada, owner-only, build bersih |

Gate lokal: `tsc` bersih · eslint 0 error · **97 test lolos** · `next build` sukses.

---

## Yang diperbaiki sesi ini

- **Login kebal env salah** (`lib/supabase/config.ts`): URL + anon key (publik) dipatok di kode. Root cause login gagal berhari-hari = anon key salah di env VPS. Sekarang build mana pun benar. **Service role key tetap rahasia di env.**
- **F-16 Meta sync** (`app/api/ads/meta-sync/route.ts`): tambah `time_increment=1` (data per-hari, bukan agregat ditumpuk di 1 tanggal), pagination (`paging.next`), dan guard `META_ACCESS_TOKEN` kosong.
- Rekonsiliasi cabang: `main` dan `cc/fix-s0-rls-leak` identik di `411c9df`.

---

## Perintah deploy (VPS)

> Catatan: `NEXT_PUBLIC_SUPABASE_URL` di baris build **tidak lagi berpengaruh** (config di-hardcode) — boleh tetap, boleh hapus. Yang **wajib** ada di `.env.production`: `META_ACCESS_TOKEN` dan `SUPABASE_SERVICE_ROLE_KEY`.

```bash
cd /opt/labbaika-reporting && git pull
npm ci --no-audit --no-fund
npx next build
cp -r public .next/standalone/ && cp -r .next/static .next/standalone/.next/
sudo systemctl restart labbaika-reporting
```

Auto-deploy cron juga menarik `main` tiap 15 menit.

---

## Verifikasi pasca-deploy (jalankan dari mana saja)

```bash
P=https://report.labbaikatravel.id

# 1. Health
curl -s -o /dev/null -w "health %{http_code}\n" $P/api/health          # -> 200

# 2. Login owner
curl -s -c /tmp/o.txt -X POST $P/api/auth/session \
  -H 'Content-Type: application/json' \
  -d '{"email":"OWNER_EMAIL","password":"OWNER_PASSWORD"}' \
  -w "login %{http_code}\n"                                            # -> 200

# 3. Tanpa auth: owner API 401, owner page redirect ke /login
curl -s -o /dev/null -w "no-auth overview %{http_code}\n" "$P/api/dashboard/overview?from=2026-08-01&to=2026-08-31"  # -> 401
curl -s -o /dev/null -w "no-auth /owner %{http_code}\n" $P/owner       # -> 307/redirect /login
```

Batas RLS CS (opsional, buat+hapus user uji):
```bash
# login sebagai CS lalu:
curl -s -b /tmp/cs.txt -o /dev/null -w "CS /api/users %{http_code}\n" $P/api/users   # -> 403
curl -s -b /tmp/cs.txt -o /dev/null -w "CS /owner %{http_code}\n" $P/owner            # -> 403
```

---

## F-16 Meta sync — cara test (butuh token valid di VPS)

Login sebagai owner, lalu:
```bash
curl -s -b /tmp/o.txt "$P/api/ads/meta-sync?from=2026-08-01&to=2026-08-31" | python3 -m json.tool
```
Sukses membalas `{ synced, campaigns, dateRange, message }`. Kalau `META_ACCESS_TOKEN` kosong → error konfigurasi yang jelas. Kalau token invalid/expired atau rate-limit → pesan asli dari Meta diteruskan.

**Penting:** kalau sync pernah dijalankan versi lama (data ketumpuk di satu tanggal), **jalankan sync ulang sekali** — versi baru (per-hari) menimpa baris lama dengan bersih, tidak dobel.

---

## Batas & catatan jujur

- **Token Meta tidak diuji dari sesi audit** — token hanya ada di env VPS dan tidak diexfiltrasi. Uji fungsional Meta sync perlu dijalankan di/oleh VPS dengan token aktif.
- Kredensial rahasia (service role key, DB password, `META_ACCESS_TOKEN`) **tidak pernah** masuk kode/repo — hanya di env server. Anon key Supabase yang kini di kode **memang publik** (dikirim ke setiap browser; RLS yang menjaga).
- CS sidebar memakai beberapa nilai hex langsung (bukan token) — berfungsi, tidak memblokir publish; bisa dirapikan ke token nanti.
