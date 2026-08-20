# Serah Terima — Persiapan Migrasi ke VPS

Untuk Hermes. Ditulis 20 Agustus 2026, difinalkan 21 Agustus setelah seluruh pekerjaan
ditutup dan diverifikasi ulang.

Berkas ini hanya soal **memindahkan sistem**. Untuk sejarah temuan dan alasan di balik
keputusan teknis, baca `10-AUDIT-FE-BE.md` — itu acuan yang menang kalau dokumen lain
(PRD, brief) bertentangan dengannya.

---

## 1. Bentuk sistemnya

| Bagian | Sekarang | Catatan untuk VPS |
|---|---|---|
| Aplikasi | Next.js 14 App Router, deploy di Vercel | Berdiri sendiri, `npm run build && npm start` |
| Database | Supabase (Postgres 15) — project `ymnttmqfwzrhqpnewbeo` | **Bagian tersulit.** Lihat §3 |
| Auth | Supabase GoTrue | Terikat ke project Supabase |
| Cron iklan | Hermes (memegang token Meta) | Sudah di sisimu |

Aplikasinya tidak menyimpan state sendiri — semua di Postgres. Yang perlu ikut pindah cuma
database dan variabel lingkungan.

**Keputusan Maszen (21 Agustus): database dan auth TETAP di Supabase cloud.** VPS hanya
melayani Next.js standalone.

Ini menyederhanakan pemindahannya secara drastis — dan menghapus risiko terbesarnya.
Memindahkan Postgres berarti GoTrue ikut pindah (`app_users.id` punya foreign key ke
`auth.users`), yaitu self-host Supabase atau mengganti sistem auth seluruhnya. Itu tidak
jadi dilakukan.

Praktisnya: **tidak ada data yang berpindah.** Tidak ada `pg_dump`, tidak ada restore, tidak
ada jendela waktu saat database tidak konsisten. Yang berpindah hanya proses yang melayani
HTTP. Kalau VPS bermasalah, Vercel bisa dinyalakan lagi dan menunjuk database yang sama.

Migrasi database tetap dijalankan ke Supabase seperti sekarang — `scripts/apply-migrations.sh`
tetap relevan untuk migrasi berikutnya, bukan untuk pemindahan ini.

---

## 2. Variabel lingkungan

```
NEXT_PUBLIC_SUPABASE_URL        boleh sampai ke browser
NEXT_PUBLIC_SUPABASE_ANON_KEY   boleh sampai ke browser
SUPABASE_SERVICE_ROLE_KEY       SERVER ONLY — melewati seluruh RLS
META_ACCESS_TOKEN               server only (dipegang Hermes)
APP_TIMEZONE                    Asia/Jakarta
DATABASE_URL                    hanya untuk menjalankan migrasi, bukan runtime aplikasi
```

⚠️ `SUPABASE_SERVICE_ROLE_KEY` **tidak boleh** diberi prefix `NEXT_PUBLIC_`. Kunci itu
melewati seluruh RLS; kalau ter-prefix, dia ikut terkirim ke browser dan siapa pun bisa
membaca seisi database. Sudah diperiksa: saat ini hanya dipakai di satu berkas
(`app/api/users/route.ts`), server-side.

Variabel `NEXT_PUBLIC_*` **dibaked saat build**. Mengubahnya tidak berpengaruh sampai ada
build ulang — ini pernah memakan waktu berjam-jam waktu deploy pertama.

---

## 3. Migrasi database — baca ini sebelum menyentuh apa pun

**Tidak ada ledger migrasi.** Repo ini tidak memakai Supabase CLI, jadi tidak ada catatan
otomatis migrasi mana yang sudah terpasang. Satu-satunya catatan adalah tabel status di
`10-AUDIT-FE-BE.md`.

**Dua migrasi pernah terpasang separuh** karena dijalankan dengan menempel isinya ke SQL
Editor tanpa `ON_ERROR_STOP`: satu statement gagal di tengah, statement sebelumnya sudah
commit, sisanya terlewat diam-diam, dan migrasinya terlihat berhasil. Salah satunya
mematikan dashboard owner selama berhari-hari tanpa ada yang tahu penyebabnya.

Karena itu ada `scripts/apply-migrations.sh`:

```bash
export DATABASE_URL='postgresql://postgres:PASS@HOST:5432/postgres?sslmode=require'
./scripts/apply-migrations.sh --with-seed
```

Berhenti di kegagalan pertama dan menunjukkan errornya. Aman diulang — seluruh migrasi
memakai `if not exists` / `create or replace`, seluruh seed memakai `on conflict do nothing`.
Sudah diuji ke database kosong: 28 migrasi + 4 seed, bersih.

**Urutannya wajib 001 → 028.** Ada ketergantungan berantai: 023 membuang HPP dan menulis
ulang fungsi analitik, 024 menambah role `advertiser` dan menulis ulang 21 policy, 026
memperbaiki 023 yang separuh, 028 menambah export.

### Kalau database baru dibangun dari nol

Postgres biasa tidak punya schema `auth`. Jalankan `tests/sql/000_bootstrap.sql` lebih dulu
— itu membuat tiruan `auth.users` dan `auth.uid()`. **Jangan pernah menjalankannya ke
Supabase sungguhan**, di sana objek itu sudah ada.

### Verifikasi setelah migrasi

```bash
for f in tests/sql/[0-9]*.sql; do
  [ "$(basename "$f")" = 000_bootstrap.sql ] && continue
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$f" || echo "GAGAL $f"
done
```

20 berkas harus lulus. Test ini menjalankan diri sebagai role `anon` dan `authenticated`
sungguhan, bukan superuser — superuser melewati RLS, dan itulah sebabnya dua bug S0 lolos
berbulan-bulan.

---

## 4. Keadaan infrastruktur — hasil audit 20 Agustus

### Aman, sudah diverifikasi langsung

- **Rahasia tidak pernah ter-commit.** Seluruh riwayat git disisir, nol temuan.
  `.gitignore` menutup `.env*.local`, dan hanya `.env.example` yang ter-track.
- **RLS menahan seluruh akses anonim.** Diuji satu per satu ke 21 tabel dan 4 view dengan
  anon key sungguhan: semua membalas kosong atau ditolak. Satu-satunya yang membalas data
  adalah `regions` — itu disengaja, data wilayah Kemendagri yang memang publik.
- **Tulis anonim ditolak.** Percobaan INSERT ke 8 tabel dan percobaan menaikkan peran
  sendiri lewat PATCH `app_users` semuanya gagal. Nol baris tertulis.
- **CI meliputi typecheck, lint, 97 test unit, dan 20 berkas test SQL** terhadap Postgres
  sungguhan.
- **Dependensi produksi minimal** — 7 paket.

### Perlu ditangani saat pindah

**a. Tidak ada backup.** Dashboard Supabase menunjukkan "No backups" — paket gratis tidak
menyertakannya. Karena database tidak ikut pindah, ini bukan risiko pemindahan — tapi tetap
risiko terbesar yang dipunya sistem ini. Satu `drop table` yang salah dan tidak ada jalan
pulang. Jadwalkan `pg_dump` rutin dari VPS (kredensialnya sudah ada di sana), atau naikkan
paket Supabase.

**b. Lapis grant lebih longgar dari RLS.** Percobaan INSERT anon ke `closings` menembus
sampai trigger, artinya anon punya privilege INSERT di tabel itu — hanya RLS yang
menahannya. Datanya aman (terbukti), tapi itu satu lapis, bukan dua. Penyebabnya default
privilege Supabase yang memberi hak ke `anon` pada objek baru — pola yang sama pernah jadi
kebocoran S0-01 lewat view. Layak ditutup dengan `revoke` eksplisit saat menyiapkan
database baru.

**c. 5 kerentanan `high`,** seluruhnya menuntut Next 16 — lompatan mayor framework. Sudah
diputuskan sebagai pekerjaan tersendiri, bukan diselipkan. Momen pindah ke VPS adalah waktu
yang wajar untuk mengerjakannya.

**d. Tidak ada rate limiting di aplikasi.** Kode error `RATE_LIMITED` ada di
`lib/constants/enums.ts` tapi tidak pernah dipakai. Login bersandar penuh pada rate limit
bawaan GoTrue. Kalau auth ikut pindah dari Supabase, perlindungan itu ikut hilang — pastikan
ada penggantinya.

---

## 5. Yang tidak boleh berubah

Ini invariant keamanan yang sudah dibayar mahal. Kalau ada yang tampak bisa disederhanakan,
baca dulu temuan yang disebutkan.

1. **CS tidak punya policy SELECT di tabel `closings`.** Itu disengaja. CS membaca lewat
   `v_closings_cs`, yang tidak punya kolom biaya. Memberi CS SELECT langsung membatalkan
   seluruh strategi itu. (S0-02, migrasi 020)
2. **Keempat fungsi analitik `security definer` dengan guard brand DAN role di dalamnya.**
   Filter di TypeScript bukan batas keamanan — fungsinya bisa dipanggil langsung dari
   browser dengan anon key. (S0-01 dan #23, migrasi 019/023)
3. **`v_closing_enriched` tidak boleh punya grant ke `anon` maupun `authenticated`.** Dulu
   bocor ke publik lengkap dengan nama, WhatsApp, dan email jamaah. (S0-01, migrasi 019)
4. **Service role hanya untuk membuat identitas auth.** Insert ke `app_users` tetap lewat
   klien pemanggil supaya RLS yang menentukan `brand_id`. (#15)
5. **Test SQL dijalankan sebagai role sungguhan**, tidak pernah superuser. (#18)

---

## 6. Urutan yang disarankan

Database tidak disentuh sama sekali di seluruh urutan ini.

```
1. Node 20 di VPS                    → verifikasi: node -v (CI memakai 20, samakan)
2. Build + salin berkas statis       → verifikasi: server.js jalan, halaman ada CSS-nya
3. Pasang env, jalankan via systemd  → verifikasi: curl localhost:3000/api/health → success:true
4. nginx reverse proxy + TLS         → verifikasi: https://domain/api/health dari luar
5. Update Supabase Auth URL          → verifikasi: lihat §6b — JANGAN dilewat
6. DNS pindah ke VPS                 → verifikasi: dig, lalu login sungguhan
7. Amati Vercel dan VPS bersamaan    → verifikasi: beberapa jam tanpa error
8. Matikan Vercel                    → verifikasi: situs tetap hidup
```

Vercel dibiarkan hidup sampai langkah 8 sebagai jalan pulang. Karena keduanya menunjuk
database yang sama, kembali ke Vercel cukup dengan mengembalikan DNS — tidak ada data yang
perlu disinkronkan.

### 6a. Berkas statis tidak ikut di standalone

`output: "standalone"` **tidak menyalin** `public/` dan `.next/static`. Keduanya harus
disalin manual:

```bash
npm ci && npm run build
cp -r public       .next/standalone/
cp -r .next/static .next/standalone/.next/
node .next/standalone/server.js
```

Kalau langkah salin terlewat, aplikasinya tetap jalan dan halaman tetap terbuka — tapi tanpa
CSS dan tanpa logo. Gejalanya mirip "build rusak" padahal cuma berkas statis yang tidak ikut.

### 6b. Supabase Auth URL harus diperbarui saat ganti domain

**Ini yang paling mudah terlewat dan paling membingungkan saat terjadi.**

Supabase → Authentication → URL Configuration menyimpan **Site URL** dan **Redirect URLs**,
dan sekarang isinya domain Vercel. Tautan undangan dan reset password yang dihasilkan
`generateLink()` membawa `redirect_to` yang divalidasi terhadap daftar itu.

Kalau tidak diperbarui setelah pindah domain: tautan undangan untuk CS baru akan mengarahkan
mereka kembali ke domain Vercel yang sudah mati, atau ditolak GoTrue sebagai redirect tidak
sah. Aplikasinya sendiri terlihat normal — yang rusak hanya alur penambahan user dan reset
password, dan itu baru ketahuan saat ada CS baru didaftarkan.

Tambahkan domain VPS **sebelum** DNS dipindah, dan biarkan domain Vercel tetap terdaftar
sampai langkah 8 selesai.

---

## 7. Keadaan kode saat serah terima

Seluruh temuan `10-AUDIT-FE-BE.md` sudah ditutup: 22 diperbaiki, 2 dicoret setelah diperiksa,
2 keputusan produk tercatat. Sembilan belas layar sudah disamakan dengan prototype.

Diverifikasi ulang 21 Agustus, tepat sebelum berkas ini difinalkan:

| Pemeriksaan | Hasil |
|---|---|
| `npm run typecheck` | bersih |
| `npm run lint` | 0 error (1 warning lama: custom font di `app/layout.tsx`) |
| `npm test` | 97 lulus |
| `tests/sql/*` lewat `apply-migrations.sh` ke database kosong | 20 berkas, 0 gagal |
| `npm run build` | sukses, `.next/standalone/server.js` terbentuk |
| Silang pemanggilan API di FE terhadap route yang ada | 31 route, tidak ada yang menggantung |

Migrasi tertinggi saat ini **028**. Berikutnya 029 — **jangan berasumsi**, periksa
`ls supabase/migrations/` sebelum menulis, karena pekerjaan bisa berlanjut setelah berkas ini
ditulis.

### Batas yang jujur

Dua hal tidak pernah bisa diverifikasi dari lingkungan tempat pekerjaan ini dilakukan, dan
sebaiknya tidak dianggap terbukti:

**Tidak satu pun dari 19 layar pernah dilihat langsung.** Tidak ada kredensial login di
lingkungan agent. Yang diverifikasi: struktur, kontrak komponen, keamanan, nilai terukur
(`getComputedStyle` dibandingkan langsung dengan prototype untuk sidebar), dan seluruh
perilaku basis data lewat test SQL sebagai role sungguhan. Penilaian visual milik pemilik
produk.

**Dua alur hanya ditinjau lewat konstruksi kode**, bukan dijalankan, karena datanya belum
ada saat itu: F-05 langkah 4 beserta panel Ringkasan (butuh program dan harga terisi), dan
pembatalan closing di `/cs/closing/riwayat` (butuh closing tersimpan). Keduanya akan
terjawab sendiri begitu data pertama masuk — layak dijadikan bagian dari uji asap setelah
pindah.

---

## 8. Trial dan migrasi bisa jalan bersamaan

Karena database tidak ikut pindah, penyiapan VPS dan uji coba aplikasi **tidak saling
menunggu**. Keduanya menunjuk Supabase yang sama.

| Jalur | Siapa | Kapan |
|---|---|---|
| Trial: isi program, harga, CS, CSV iklan; pakai aplikasinya | Maszen, di Vercel | sekarang |
| Siapkan VPS: Node, build, systemd, nginx, TLS | Hermes | sekarang, paralel |
| Tambah domain VPS di Supabase Auth URL | Maszen | sebelum DNS |
| Pindah DNS | bersama | setelah dua jalur di atas selesai |
| Matikan Vercel | Hermes | setelah beberapa jam tenang |

Data yang dimasukkan Maszen selama trial **langsung terlihat** dari VPS begitu VPS menyala —
tidak ada yang perlu disalin ulang, tidak ada yang perlu diulang. Trial di Vercel hari ini
adalah trial untuk VPS juga.

Satu-satunya langkah yang butuh koordinasi adalah pemindahan DNS. Sebelum itu, keduanya bisa
berjalan tanpa saling mengganggu.

Yang tidak boleh paralel: **jangan menjalankan migrasi database dari dua tempat sekaligus.**
Tidak ada ledger yang menahan tabrakan (§3). Kalau ada migrasi baru selama masa ini, satu
orang saja yang menjalankannya.

---

## 9. Uji asap setelah pindah

Urutan ini menyentuh setiap lapis yang bisa rusak karena pemindahan, dari luar ke dalam.

```
1. GET /api/health                      → {"success":true,...,"query_ok":true}
2. Buka /, belum login                  → dilempar ke /login, CSS dan logo muncul
3. Login sebagai owner/advertiser       → mendarat di /owner
4. Dashboard Overview                   → kartu terisi, tidak ada pita error
5. Tambah satu program + harga          → tersimpan, muncul di daftar
6. Tambah satu user CS                  → tautan undangan muncul (menguji §6b)
7. Buka tautan itu di jendela lain      → mengarah ke domain BARU, bukan Vercel
8. Login sebagai CS, simpan laporan     → tersimpan
9. Catat satu closing sampai langkah 4  → tersimpan, Ringkasan tampil
10. Buka /cs/closing/riwayat, batalkan  → bucket di laporan asal pulih (trigger T-1)
```

Langkah 7 yang menguji jebakan paling halus di §6b. Langkah 9 dan 10 sekaligus menutup dua
alur yang belum pernah dijalankan sungguhan.

Kalau langkah 4 menampilkan pita error, penyebabnya hampir pasti bukan pemindahan — cek
`10-AUDIT-FE-BE.md` §22 dan §23, dua kali kejadian itu berasal dari migrasi yang terpasang
separuh.
