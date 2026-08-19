# Work Order — DeepSeek / Hermes (Minor)

Sumber temuan: `07-AUDIT-REPO.md`
Lingkup: **S1-03 (bagian frontend), S1-04, S2-06, S2-09.** Semua terisolasi, tidak bersinggungan dengan pekerjaan Sonnet.

Branch: `ds/fix-s1-s2`

## Batas yang tidak boleh dilanggar

Mengikuti `06-TASKS-DeepSeek-Minor.md`. **Jangan sentuh:**

- berkas migrasi yang berisi trigger, constraint exclusion, atau RLS
- SQL agregat, view, atau rumus metrik apa pun
- logika autentikasi dan permission
- **berkas mana pun yang sedang dikerjakan Sonnet:** `app/api/closings/**`, `supabase/migrations/019_*`, `app/api/dashboard/cs-performance/route.ts`

Kalau sebuah task terasa butuh menyentuh salah satu di atas, hentikan dan kembalikan.

⚠️ Repo ini **publik**. Jangan menulis password, key, atau token ke berkas apa pun.

---

## S1-03 (bagian FE) — Idempotency key dibuat ulang tiap klik

**Berkas:** `app/cs/laporan/page.tsx` (1 berkas, baris ~78)

### Masalah

```ts
idempotency_key: crypto.randomUUID(),   // di dalam handleSubmit
```

Dipanggil di dalam `handleSubmit`, jadi **setiap klik menghasilkan key baru**. Idempotency jadi tidak berfungsi sama sekali: klik dua kali, atau CS menekan ulang karena sinyal lambat, mengirim key berbeda → lolos pengecekan duplikat → tabrakan di constraint lain → error 500.

Terbukti di audit:

```
submit ke-1 dengan 'key-A'  → berhasil
submit ke-2 dengan 'key-B'  → CRASH 23505: duplicate key value
                               violates unique constraint "lead_reports_uniq"
```

Ini persis skenario yang diantisipasi audit PRD P1-08 ("CS klik Simpan dua kali karena sinyal lemah").

### Yang dikerjakan

Bikin key **sekali per pengisian form**, bukan per klik:

```ts
const [idempotencyKey] = useState(() => crypto.randomUUID());
```

Pakai `idempotencyKey` di body request. Buat key baru hanya saat form dibuka ulang atau setelah simpan berhasil (mis. lewat `key` prop pada komponen, atau reset state setelah sukses).

### Verifikasi

Klik "Simpan laporan" dua kali cepat → hanya satu laporan tersimpan, tidak ada error 500. Kalau tombol sempat ter-disable saat `submitting`, uji juga dengan mematikan jaringan lalu menyalakannya dan menekan simpan lagi.

**Catatan:** sisi backend dari bug ini (memetakan tabrakan `lead_reports_uniq` menjadi pesan ramah, bukan 500) masuk ke S1-04 di bawah.

---

## S1-04 — Pesan error mentah Postgres dikirim ke klien

**Berkas:** seluruh `app/api/**/route.ts` **kecuali** `app/api/closings/**` (sedang dipegang Sonnet — kerjakan berkas itu belakangan setelah Sonnet merge, atau lewati saja)

### Masalah

Pola yang tersebar di hampir semua route:

```ts
return NextResponse.json(fail("INTERNAL_ERROR", error.message), { status: 500 });
```

`error.message` dari Postgres memuat nama tabel, nama constraint, kadang isi baris. Semua itu terkirim ke browser. Untuk aplikasi yang menyimpan data pribadi jamaah, ini memperluas permukaan serangan tanpa manfaat apa pun bagi pengguna.

### Yang dikerjakan

Log detail di server, kirim pesan generik ke klien:

```ts
console.error("[api/<nama-route>]", error);
return NextResponse.json(fail("INTERNAL_ERROR"), {
  status: httpStatus("INTERNAL_ERROR"),
});
```

`ERROR_MESSAGES.INTERNAL_ERROR` di `lib/constants/error-messages.ts` sudah berisi kalimat Indonesia yang layak dibaca pengguna, jadi `fail()` tanpa argumen kedua sudah cukup.

**Yang tetap dipertahankan:** cabang error yang sudah memetakan kondisi spesifik ke pesan ramah — `PERIOD_LOCKED`, `STAGE_UNDERFLOW`, `VALIDATION_ERROR`, `DUPLICATE_CONFLICT`, `PRICE_NOT_FOUND`, `CONFLICT`. Itu memang ditujukan untuk pengguna dan sudah aman. Yang diganti **hanya** cabang `INTERNAL_ERROR` penutup.

**Tambahan di `app/api/lead-reports/route.ts`** — lengkapi bagian backend S1-03:

```ts
if (error.message.includes("lead_reports_uniq")) {
  return NextResponse.json(
    fail("CONFLICT", "Laporan untuk tanggal dan source ini sudah ada. Buka menu koreksi untuk mengubahnya."),
    { status: httpStatus("CONFLICT") },
  );
}
```

Letakkan **sebelum** cabang `INTERNAL_ERROR` penutup.

**Jangan ubah** logika query, validasi, atau alur permission di route mana pun. Hanya cabang penanganan error.

### Verifikasi

`npm run typecheck` dan `npm test` hijau. Picu satu error server (mis. kirim `source_id` UUID yang tidak ada) → respons tidak lagi memuat nama tabel atau constraint.

---

## S2-06 — Kategori insight tidak sesuai PRD

**Berkas:** `supabase/seed/insight_categories.sql` + satu berkas skrip update data

### Masalah

Seed sekarang berisi kategori operasional marketing:

> Lead Masuk, Konversi, CPL, Budget, Kreatif, Timing, Wilayah, Produk, Harga, Kompetitor, Follow-up, Kualitas Lead, Musiman, Testimoni, Operasional

`02-PRD-v1.3.md` §6 meminta **alasan lead tidak closing**:

> Harga, Program, Jadwal keberangkatan, Itinerary, Hotel, Tiket, Visa, Fasilitas, Pembayaran/DP, Promo, Membandingkan travel, Diskusi pasangan/keluarga, Menunggu keputusan, Belum menentukan tanggal, Lainnya

Dua daftar ini beda domain. Dashboard "Top Reason Not Closing" (F-10) akan menampilkan kategori yang tidak menjawab pertanyaannya.

### Yang dikerjakan

1. Ganti isi `supabase/seed/insight_categories.sql` dengan 15 kategori §6. **Pertahankan struktur berkasnya** — pola `insert ... select from brands cross join (values ...) where b.slug='labbaika' on conflict (brand_id, slug) do nothing` sudah benar, hanya isinya yang diganti. Slug: huruf kecil, tanpa spasi (`harga`, `jadwal_keberangkatan`, `pembayaran_dp`, `banding_travel`, `diskusi_keluarga`, `menunggu_keputusan`, `belum_tentukan_tanggal`, `lainnya`, dst).

2. Buat `supabase/seed/updates/2026-08-19_insight_categories.sql` untuk database yang sudah terisi: hapus 15 baris lama, masukkan yang baru.

**Aman dilakukan sekarang** karena `lead_report_insights` masih kosong (0 baris) — tidak ada foreign key yang menunjuk kategori lama. Verifikasi dulu sebelum menghapus:

```sql
select count(*) from lead_report_insights;   -- harus 0
```

Kalau **tidak** 0, hentikan dan kembalikan — berarti sudah ada data CS yang menunjuk kategori lama, dan penghapusan akan merusaknya. Itu butuh pemetaan, bukan penghapusan.

### Verifikasi

```sql
select count(*) from insight_categories;  -- 15
select name from insight_categories order by sort_order;  -- cocok dengan §6
```

---

## S2-09 — Tidak ada linting

**Berkas:** `eslint.config.mjs` (baru), `package.json`, `.github/workflows/ci.yml`

### Masalah

CI hanya menjalankan typecheck dan test. ESLint tidak terpasang sama sekali. Pola berbahaya lolos tanpa peringatan — terutama dependency array `useEffect` yang salah, yang di aplikasi ini bisa berarti data dashboard tidak ter-refresh saat filter berubah.

### Yang dikerjakan

1. Pasang `eslint` + `eslint-config-next` sesuai versi Next yang dipakai (14.x — **jangan** menaikkan versi Next).
2. `eslint.config.mjs` flat config, extends `next/core-web-vitals` dan `next/typescript`.
3. **Wajib** `ignores`: `[".next/**", "node_modules/**", "coverage/**", "ponytail/**", "hallmark/**", "ui-ux-pro-max-skill/**", ".agents/**"]` — ada beberapa direktori tool pihak ketiga di working directory ini yang bukan bagian proyek; tanpa ignore, lint akan melaporkan ratusan error dari berkas orang lain.
4. Tambah `"lint": "eslint ."` ke scripts.
5. Tambah step Lint ke `ci.yml`, **setelah** typecheck.

Perbaiki error yang muncul di berkas milik proyek ini saja (`app/`, `lib/`, `components/`). Kalau ada error yang perbaikannya menyentuh logika, jangan diperbaiki — laporkan.

### Verifikasi

`npm run lint` bersih. CI hijau.

---

## Definition of done

- [ ] Klik simpan laporan dua kali → satu baris tersimpan, tidak ada 500
- [ ] Tidak ada `error.message` mentah Postgres di respons API mana pun
- [ ] Tabrakan `lead_reports_uniq` membalas pesan Indonesia yang jelas, bukan 500
- [ ] 15 kategori insight cocok dengan PRD §6
- [ ] `npm run lint`, `npm run typecheck`, `npm test` semua hijau
- [ ] Tidak menyentuh `app/api/closings/**` atau migrasi 019 (milik Sonnet)
- [ ] Tidak ada rahasia tertulis di berkas mana pun
