# Audit Repo — Labbaika Reporting

Tanggal: 19 Agustus 2026
Basis: seluruh commit di `main` (`40eaa24`), diuji langsung terhadap Supabase project `ymnttmqfwzrhqpnewbeo`.
Metode: eksekusi nyata (psql sebagai role `anon`/`authenticated`, curl ke REST API publik), bukan pembacaan kode saja.

Severity:
- **S0** = data sensitif bocor keluar, atau fitur inti tidak jalan sama sekali. Blokir rilis.
- **S1** = bikin crash / error 500 di alur normal pemakaian.
- **S2** = fitur tidak lengkap atau berpotensi salah, tidak bikin crash.

---

## S0-01. HPP dan data pribadi jamaah bisa dibaca publik tanpa login

**Lokasi:** `supabase/migrations/016_analytics_views.sql` (view `v_closing_enriched`, `v_lead_funnel_daily`, `v_ads_daily`), interaksi dengan default grant Supabase.

**Bukti (dieksekusi nyata, bukan simulasi):**

```bash
curl -s "https://<project>.supabase.co/rest/v1/v_closing_enriched?select=first_name,whatsapp_e164,email,total_value,cost_of_sales,gross_profit" \
  -H "apikey: <ANON_KEY>"
```

Hasil:

```json
[{"first_name":"PENTEST","whatsapp_e164":"+6281299998888","email":"pentest@x.test",
  "total_value":32900000,"cost_of_sales":28952000,"gross_profit":3948000}]
```

Anon key itu **kunci publik** — dikirim ke browser di setiap page load, bisa dibaca siapa pun lewat DevTools. Artinya siapa pun di internet bisa menarik seluruh isi tabel closing: nama, WhatsApp, email jamaah, plus HPP dan gross profit per transaksi.

**Dua aturan yang dilanggar sekaligus:**
1. `05-TASKS-ClaudeCode-Major.md` CC-B14: "Kebocoran HPP ke CS adalah kegagalan paling mahal di sistem ini." Kenyataannya bocor lebih jauh dari CS — bocor ke publik.
2. UU PDP: data pribadi jamaah terekspos tanpa dasar pemrosesan apa pun.

**Akar masalah (dua hal bertumpuk):**

1. Supabase memasang `ALTER DEFAULT PRIVILEGES ... GRANT ALL ON TABLES TO anon, authenticated` di schema `public`. View yang dibuat migrasi 016 otomatis kebagian grant itu. Terkonfirmasi lewat `information_schema.role_table_grants`: `anon` punya SELECT (bahkan INSERT/UPDATE/DELETE) di `v_closing_enriched`.
2. View di Postgres berjalan dengan hak **pemilik view**, bukan pemanggil, kecuali ditandai `security_invoker = true`. Jadi RLS di tabel `closings` dilewati sepenuhnya lewat view.

Ini mekanisme yang sama yang sengaja dipakai untuk `v_closings_cs` (supaya CS bisa baca closing miliknya tanpa hak SELECT di tabel dasar). Di `v_closings_cs` itu fitur — ada `where brand_id = current_brand_id() and cs_id = auth.uid()`. Di `v_closing_enriched` itu lubang: tidak ada filter apa pun, dan kolom biaya ikut terbawa.

**Fix:**

```sql
-- 1. Cabut akses langsung ke view yang membawa kolom biaya/PII.
revoke all on v_closing_enriched from anon, authenticated;
revoke all on v_lead_funnel_daily from anon, authenticated;
revoke all on v_ads_daily from anon, authenticated;

-- 2. Cabut hak tulis yang tidak pernah masuk akal untuk sebuah view.
--    (default grant Supabase memberi INSERT/UPDATE/DELETE/TRUNCATE juga)

-- 3. Fungsi analitik yang membaca view tersebut harus SECURITY DEFINER,
--    karena setelah revoke di atas pemanggil tidak lagi punya akses view.
alter function get_dashboard_overview(uuid,date,date,text,uuid,uuid)
  security definer set search_path = public;
alter function get_campaign_quality(uuid,date,date,text)
  security definer set search_path = public;
alter function get_cs_performance(uuid,date,date)
  security definer set search_path = public;
alter function get_lead_insight_summary(uuid,date,date)
  security definer set search_path = public;
```

**Wajib menyusul fix di atas:** begitu fungsi jadi SECURITY DEFINER, fungsi itu tidak lagi dijaga RLS — jadi **pengecekan brand dan role harus dilakukan di dalam fungsi**, tidak boleh diserahkan ke pemanggil. Minimal:

```sql
-- di awal setiap fungsi
if p_brand_id <> current_brand_id() then
  raise exception 'akses ditolak';
end if;
```

Tanpa itu, satu CS bisa mengirim `p_brand_id` milik brand lain dan menarik angkanya.

**Verifikasi setelah fix:** ulangi curl di atas dengan anon key — harus balas error permission, bukan data. Lalu ulangi sebagai owner lewat API — harus tetap balas angka yang benar.

---

## S0-02. CS tidak bisa menyimpan closing sama sekali

**Lokasi:** `app/api/closings/route.ts:105` (`.insert(...).select().single()`), `app/api/closings/[id]/route.ts:50`, `app/api/closings/[id]/cancel/route.ts:31`.

**Bukti:** dua statement identik, dijalankan sebagai role `authenticated` dengan JWT claim seorang CS:

```
INSERT INTO closings (...) VALUES (...);                  -- INSERT 0 1   (berhasil)
INSERT INTO closings (...) VALUES (...) RETURNING id;     -- ERROR: new row violates
                                                          -- row-level security policy
```

Supabase JS client menerjemahkan `.insert().select()` menjadi `INSERT ... RETURNING`. `RETURNING` menuntut hak SELECT, sedangkan RLS di migrasi 013 sengaja **tidak memberi policy SELECT** kepada CS di tabel `closings` (itu bagian dari desain anti-bocor HPP — CS membaca lewat `v_closings_cs`).

Akibatnya alur closing (F-05), fitur inti yang dipakai CS setiap hari, **selalu gagal** untuk role CS. Ini tidak pernah ketahuan karena semua pengujian sebelumnya dijalankan sebagai superuser, yang melewati RLS.

**Fix (pilih salah satu, jangan dua-duanya):**

- **Opsi A (paling kecil):** hapus `.select()` dari ketiga route, balas `ok({ id })` dari input atau lakukan pembacaan terpisah lewat `v_closings_cs`.
- **Opsi B:** tambah policy SELECT untuk CS di `closings` yang dibatasi `cs_id = auth.uid()`. **Tapi ini membatalkan seluruh strategi penyembunyian HPP** — begitu CS punya SELECT di tabel dasar, dia bisa `select cost_at_transaction from closings`. Jangan ambil opsi ini kecuali kolom biaya dipindah ke tabel terpisah.

Rekomendasi: **Opsi A**.

**Verifikasi:** login sebagai CS di aplikasi, simpan satu closing, harus tersimpan dan muncul di daftar. Lalu `select cost_at_transaction from closings` sebagai CS — harus tetap kosong/ditolak.

---

## S1-03. Simpan laporan dua kali bikin error 500

**Lokasi:** `app/cs/laporan/page.tsx:78`, `supabase/migrations/014_lead_report_batch_fn.sql:54`.

**Bukti:**

```
perform create_lead_report_batch(..., 'key-A');  -- first submit OK
perform create_lead_report_batch(..., 'key-B');  -- CRASH 23505:
   duplicate key value violates unique constraint "lead_reports_uniq"
```

`crypto.randomUUID()` dipanggil **di dalam** `handleSubmit`, jadi setiap klik menghasilkan key baru. Idempotency key jadi tidak ada gunanya: klik dua kali, koneksi lambat lalu CS menekan ulang, atau retry manual — semuanya mengirim key berbeda.

Fungsi batch hanya menangani konflik pada `(brand_id, idempotency_key)`. Konflik pada `lead_reports_uniq` (brand, cs, tanggal, source, campaign) tidak ditangani, jatuh ke `INTERNAL_ERROR` 500, dan pesan mentah Postgres ikut dikirim ke klien.

Ini persis skenario yang diantisipasi audit PRD P1-08 ("CS klik Simpan dua kali karena sinyal lemah") — mekanismenya dibangun tapi tidak tersambung.

**Fix (dua-duanya perlu):**

1. FE: bikin key sekali per pengisian form, bukan per klik.
   ```ts
   const [idempotencyKey] = useState(() => crypto.randomUUID());
   ```
   Reset hanya setelah simpan berhasil atau saat form dibuka ulang.

2. BE: tangani juga konflik `lead_reports_uniq` di route sebagai pesan ramah, bukan 500.
   ```ts
   if (error.message.includes("lead_reports_uniq")) {
     return NextResponse.json(
       fail("CONFLICT", "Laporan untuk tanggal dan source ini sudah ada. Buka menu koreksi untuk mengubahnya."),
       { status: httpStatus("CONFLICT") });
   }
   ```

Catatan: jangan pernah kirim `error.message` mentah dari Postgres ke klien — itu membocorkan nama tabel dan constraint. Berlaku untuk semua route, bukan cuma yang ini.

---

## S1-04. Pesan error mentah Postgres dikirim ke klien

**Lokasi:** hampir semua route, pola `fail("INTERNAL_ERROR", error.message)`.

Nama tabel, nama constraint, kadang isi baris ikut terkirim ke browser. Untuk aplikasi yang menyimpan data pribadi jamaah, ini memperluas permukaan serangan tanpa manfaat apa pun bagi pengguna.

**Fix:** log detail di server, kirim pesan generik ke klien.

```ts
console.error("[api/closings]", error);
return NextResponse.json(fail("INTERNAL_ERROR"), { status: 500 });
```

`ERROR_MESSAGES.INTERNAL_ERROR` sudah berisi kalimat Indonesia yang layak dibaca pengguna.

---

## S2-05. Alur koreksi laporan H-7 tidak bisa dipakai

**Lokasi:** `app/api/lead-reports/[id]/route.ts` (hanya punya PATCH), `app/cs/page.tsx`.

`PATCH /api/lead-reports/:id` sudah ada, tapi:
- tidak ada `GET /api/lead-reports/:id` untuk memuat isi laporan lama ke form;
- tidak ada tombol "Koreksi laporan lama" di beranda CS;
- form laporan tidak punya mode edit.

Padahal koreksi H-7 adalah kompensasi yang dijanjikan PRD §3.4 untuk keterbatasan model agregat. Tanpa ini, `reached_consultation` dan `reached_offering` akan understate permanen dan tidak ada cara memperbaikinya.

**Fix:** tambah GET single, tambah tombol + daftar 7 hari di beranda, buat form laporan menerima `?id=` untuk mode edit (PATCH, bukan POST).

---

## S2-06. Kategori insight tidak sesuai PRD

**Lokasi:** `supabase/seed/insight_categories.sql`.

Isi seed: Lead Masuk, Konversi, CPL, Budget, Kreatif, Timing, Wilayah, Produk, Harga, Kompetitor, Follow-up, Kualitas Lead, Musiman, Testimoni, Operasional.

PRD v1.3 §6 meminta: Harga, Program, Jadwal keberangkatan, Itinerary, Hotel, Tiket, Visa, Fasilitas, Pembayaran/DP, Promo, Membandingkan travel, Diskusi pasangan/keluarga, Menunggu keputusan, Belum menentukan tanggal, Lainnya.

Dua daftar ini beda domain: yang terpasang adalah kategori operasional marketing, yang diminta adalah **alasan lead tidak closing**. Dashboard "Top Reason Not Closing" (F-10) akan menampilkan kategori yang tidak menjawab pertanyaannya.

Sudah 15 baris terisi di database, jadi perlu migrasi data, bukan sekadar ganti file seed.

**Fix:** ganti isi seed sesuai §6, dan buat skrip update untuk database yang sudah terisi (aman sekarang karena `lead_report_insights` masih kosong).

---

## S2-07. Form closing bukan wizard 4 langkah

**Lokasi:** `app/cs/closing/page.tsx`.

Brief F-05 meminta 4 langkah dengan progress dots (Customer → Lead → Paket → Lokasi & review). Yang ada satu halaman panjang. Semua field lengkap dan validasi jalan, jadi ini soal kegunaan di HP, bukan kebenaran data. CS harus menggulir jauh untuk satu transaksi.

---

## S2-08. Antrean offline belum ada

**Lokasi:** `app/cs/laporan/page.tsx`.

Kalau jaringan putus, form hanya menampilkan pesan "tersimpan di perangkat" — padahal tidak ada yang tersimpan. Isian hilang saat halaman ditutup.

PRD §18 dan CC-F10 meminta antrean IndexedDB dengan retry. Perlu diperbaiki atau teks pesannya diubah supaya tidak berbohong ke CS.

---

## S2-09. Tidak ada linting

`.github/workflows/ci.yml` menjalankan typecheck dan test, tidak ada lint. ESLint tidak terpasang sama sekali di branch ini. Bug gaya dan pola berbahaya (unused var, dependency array useEffect yang salah) lolos tanpa peringatan.

---

## S2-10. Kerentanan dependensi

`npm audit`: 7 kerentanan (3 moderate, 3 high, 1 critical), sebagian besar di Next.js 14.2.5 — termasuk cache poisoning, XSS di App Router dengan CSP nonce, dan beberapa DoS.

Belum dinaikkan versinya supaya 82 test yang ada tidak pecah. Perlu upgrade terkontrol ke rilis patch terbaru di jalur 14.x lebih dulu, jalankan seluruh test, baru pertimbangkan 15.x.

---

## Yang sudah diuji dan terbukti benar

Supaya jelas mana yang tidak perlu disentuh:

| Area | Bukti |
|---|---|
| RLS di tabel dasar | `anon` dan CS dapat 0 baris di `program_costs`, `brand_settings`, `closings` |
| Trigger T-1 | closing masuk → `offering` 2→1, `closing` 0→1, `total_lead` tetap |
| Trigger T-6, T-7 | normalisasi WhatsApp dan penguncian HPP jalan saat insert nyata |
| Isolasi antar-CS | CS B dapat 0 baris milik CS A di `lead_reports` dan `v_closings_cs` |
| `v_closings_cs` | tidak punya kolom `cost_at_transaction`/`cost_of_sales`/`gross_profit` |
| Perhitungan ROI | fixture PRD §11 menghasilkan 690% dan 2.269% persis |
| Seed | 38 provinsi, 514 kota, 6 source, 15 kategori |
| Dashboard data kosong | balas 1 baris berisi NULL, tidak crash `.single()` |
| PATCH lead_reports | jalan untuk CS (punya policy SELECT di tabel itu) |

---

## Urutan pengerjaan yang disarankan

1. **S0-01** — sedang bocor sekarang, ke publik. Kerjakan lebih dulu dari apa pun.
2. **S0-02** — fitur inti CS mati total.
3. **S1-03**, **S1-04** — crash dan kebocoran informasi di alur normal.
4. **S2-06** — perbaiki selagi `lead_report_insights` masih kosong; makin lama makin mahal.
5. Sisanya sesuai prioritas produk.

S0-01 dan S0-02 saling bersinggungan di area yang sama (RLS closings + view). Kerjakan berurutan oleh satu orang, jangan paralel.
