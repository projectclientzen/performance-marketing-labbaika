# Serah Terima — Persiapan Migrasi ke VPS

Untuk Hermes. Ditulis 20 Agustus 2026, setelah audit infrastruktur menyeluruh.

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

**Keputusan yang belum diambil:** apakah Postgres-nya ikut pindah ke VPS atau tetap di
Supabase. Kalau ikut pindah, GoTrue juga harus ikut (auth memakai `auth.users`, dan
`app_users.id` punya foreign key ke sana). Itu bukan sekadar `pg_dump` — self-host Supabase
atau ganti sistem auth seluruhnya. **Tanyakan ini ke Maszen sebelum merencanakan apa pun.**

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
menyertakannya. Sebelum memindahkan apa pun, ambil `pg_dump` manual. Setelah pindah,
jadwalkan backup rutin; ini yang paling penting dari seluruh daftar ini.

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

```
1. pg_dump database sekarang                     → verifikasi: dump bisa di-restore ke db kosong
2. Putuskan: Postgres ikut pindah atau tetap?    → verifikasi: jawaban dari Maszen, tertulis
3. Siapkan database tujuan                       → verifikasi: apply-migrations.sh --with-seed bersih
4. Jalankan tests/sql/*                          → verifikasi: 20 berkas lulus
5. Pindahkan data (dump lama → db baru)          → verifikasi: hitung baris tiap tabel cocok
6. Pasang env di host baru, build ulang          → verifikasi: /api/health balas success:true
7. Uji alur nyata: login, simpan closing         → verifikasi: baris masuk, trigger T-1 jalan
8. Jadwalkan backup                              → verifikasi: satu backup berhasil dibuat
```

Langkah 2 menentukan sisanya. Jangan mulai dari langkah 3 sebelum itu terjawab.

---

## 7. Pekerjaan yang masih berjalan

Per 20 Agustus masih ada beberapa tugas terbuka di `10-AUDIT-FE-BE.md` (#12, #10, #26, #17,
F-05). Semuanya kode aplikasi, tidak menyentuh skema database kecuali kalau muncul migrasi
029 — periksa nomor migrasi tertinggi sebelum mulai, jangan berasumsi 028 yang terakhir.
