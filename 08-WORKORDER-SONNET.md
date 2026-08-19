# Work Order — Claude Code (Sonnet)

Sumber temuan: `07-AUDIT-REPO.md`
Lingkup: **S0-01 dan S0-02 saja.** Keduanya menyentuh area yang sama (RLS `closings` + view analitik). Kerjakan **berurutan, satu orang, satu branch**. Jangan paralel dengan siapa pun.

Branch: `cc/fix-s0-rls-leak`

⚠️ Repo ini **publik**. Jangan pernah menulis password database, `SUPABASE_SERVICE_ROLE_KEY`, atau `META_ACCESS_TOKEN` ke file mana pun di repo. Semua perintah di bawah memakai variabel lingkungan.

Siapkan sekali di shell (jangan di-commit):

```bash
export PGPASSWORD='<password db>'
export CONN="host=db.<project-ref>.supabase.co port=5432 dbname=postgres user=postgres sslmode=require"
export ANON='<anon key>'
export SUPA_URL='https://<project-ref>.supabase.co'
```

---

## S0-01 — Tutup kebocoran HPP dan data jamaah ke publik

### Reproduksi dulu (wajib, sebelum menyentuh kode)

Isi satu closing dummy, lalu:

```bash
curl -s "$SUPA_URL/rest/v1/v_closing_enriched?select=first_name,whatsapp_e164,email,cost_of_sales,gross_profit" \
  -H "apikey: $ANON"
```

Sekarang ini membalas data. Setelah selesai, perintah yang sama harus membalas error izin. Itu ukuran keberhasilannya.

### Akar masalah

Dua hal bertumpuk, keduanya harus ditutup:

1. Supabase memasang default privilege `GRANT ALL ON TABLES TO anon, authenticated` di schema `public`. View yang dibuat migrasi 016 ikut kebagian.
2. View Postgres berjalan dengan hak **pemilik view**, bukan pemanggil, kecuali ditandai `security_invoker = true`. Jadi RLS di tabel `closings` dilewati lewat view.

`v_closings_cs` memakai mekanisme yang sama **dengan sengaja** — di sana ada filter `where brand_id = current_brand_id() and cs_id = auth.uid()`, jadi aman dan memang jalur baca CS. Jangan diutak-atik selain mencabut hak tulisnya.

### Yang dikerjakan

Buat `supabase/migrations/019_fix_view_grants.sql` (+ rollback di `supabase/migrations/rollback/`).

**Langkah 1 — cabut akses langsung ke view pembawa biaya/PII:**

```sql
revoke all on v_closing_enriched  from anon, authenticated;
revoke all on v_lead_funnel_daily from anon, authenticated;
revoke all on v_ads_daily         from anon, authenticated;

-- v_closings_cs tetap boleh dibaca `authenticated` (jalur baca CS),
-- tapi tidak ada alasan sebuah view bisa ditulis atau dibaca anon.
revoke all on v_closings_cs from anon;
revoke insert, update, delete, truncate, references, trigger
  on v_closings_cs from authenticated;
```

**Langkah 2 — fungsi analitik jadi SECURITY DEFINER.** Setelah langkah 1, pemanggil tidak lagi punya akses ke view sumbernya, jadi keempat fungsi ini akan gagal kalau tetap INVOKER:

```sql
alter function get_dashboard_overview(uuid,date,date,text,uuid,uuid)
  security definer set search_path = public;
alter function get_campaign_quality(uuid,date,date,text)
  security definer set search_path = public;
alter function get_cs_performance(uuid,date,date)
  security definer set search_path = public;
alter function get_lead_insight_summary(uuid,date,date)
  security definer set search_path = public;
```

**Langkah 3 — WAJIB, jangan dilewat.** SECURITY DEFINER membuat fungsi kebal RLS. Artinya `p_brand_id` yang dikirim pemanggil tidak lagi dijaga apa pun — seorang CS bisa mengirim `brand_id` milik brand lain dan menarik angkanya. Tambahkan penjaga di **awal setiap** fungsi (perlu diubah dari `language sql` ke `plpgsql`, atau bungkus dengan guard):

```sql
if p_brand_id is distinct from current_brand_id() then
  raise exception 'akses ditolak untuk brand tersebut' using errcode = '42501';
end if;
```

**Langkah 4 — tutup kebocoran `gross_profit` ke CS.** `get_cs_performance` boleh dipanggil role CS (lihat `app/api/dashboard/cs-performance/route.ts`) dan saat ini mengembalikan `gross_profit`, yang bisa dipakai menghitung mundur HPP: `cost = price − gross_profit`.

Terbukti di audit: CS memanggil fungsi ini dan menerima `gross_profit = 3948000`.

`02-PRD-v1.3.md` §4 menyatakan CS **tidak melihat** HPP, margin, ROI, revenue perusahaan. Jadi kosongkan kolom biaya kalau pemanggilnya bukan owner:

```sql
case when current_app_role() = 'owner' then <kolom> else null end
```

Berlaku untuk `gross_profit` dan `gross_booking_value` di `get_cs_performance`.

### Verifikasi (sertakan hasilnya di PR)

```bash
# 1. anon tidak dapat apa-apa lagi
curl -s "$SUPA_URL/rest/v1/v_closing_enriched?select=cost_of_sales" -H "apikey: $ANON"
#    harus: error izin, bukan data

# 2. owner tetap mendapat angka yang benar (lewat aplikasi, login sebagai owner)
#    dashboard overview, campaign quality, cs performance harus tampil normal

# 3. CS tidak melihat gross_profit
#    login sebagai CS, buka /cs/performa — tidak boleh ada angka profit
```

Tambahkan test SQL di `tests/sql/019_view_grants.sql` mengikuti pola berkas tetangganya: jalankan sebagai role `anon` dan `authenticated` sungguhan (`set local role`, `set_config('request.jwt.claims', ...)`), bukan sebagai superuser. **Semua pengujian sebelumnya lolos justru karena dijalankan sebagai superuser, yang melewati RLS — itu sebabnya bug ini tidak ketahuan.**

---

## S0-02 — CS tidak bisa menyimpan closing sama sekali

Kerjakan **setelah** S0-01 selesai dan terverifikasi.

### Reproduksi

Sebagai role `authenticated` dengan JWT claim seorang CS:

```sql
INSERT INTO closings (...) VALUES (...);               -- INSERT 0 1     berhasil
INSERT INTO closings (...) VALUES (...) RETURNING id;  -- ERROR: new row violates
                                                       -- row-level security policy
```

### Akar masalah

Supabase JS client menerjemahkan `.insert().select()` menjadi `INSERT ... RETURNING`. `RETURNING` menuntut hak SELECT. RLS di migrasi 013 **sengaja tidak memberi policy SELECT** kepada CS di tabel `closings` — itu justru yang membuat kolom HPP tidak bisa dibaca CS.

Jadi alur closing (F-05), fitur inti yang dipakai CS tiap hari, selalu gagal untuk role CS.

### Yang dikerjakan

Tiga berkas:

| Berkas | Baris | Sekarang |
|---|---|---|
| `app/api/closings/route.ts` | ~105 | `.insert({...}).select().single()` |
| `app/api/closings/[id]/route.ts` | ~50 | `.update({...}).select().maybeSingle()` |
| `app/api/closings/[id]/cancel/route.ts` | ~31 | `.update({...}).select().maybeSingle()` |

**Ambil pendekatan ini:** buang `.select()`, pakai `{ count: "exact" }` untuk mendeteksi baris tidak ditemukan.

```ts
const { error, count } = await supabase
  .from("closings")
  .update({ ... }, { count: "exact" })
  .eq("id", id);

if (!count) {
  return NextResponse.json(fail("NOT_FOUND", "Closing tidak ditemukan"), {
    status: httpStatus("NOT_FOUND"),
  });
}
return NextResponse.json(ok({ id }));
```

Untuk `POST /api/closings`, frontend (`app/cs/closing/page.tsx`) hanya memeriksa nilai balik itu truthy sebelum `router.push("/cs")`, jadi `ok({ saved: true })` sudah cukup. Kalau butuh id-nya, baca ulang lewat `v_closings_cs` — bukan lewat tabel dasar.

**JANGAN** menyelesaikan ini dengan menambah policy SELECT untuk CS di tabel `closings`. Itu memang membuat error hilang, tapi sekaligus membatalkan seluruh strategi penyembunyian HPP: begitu CS punya SELECT di tabel dasar, `select cost_at_transaction from closings` langsung jalan. Ini persisnya kegagalan yang disebut CC-B14 sebagai "paling mahal di sistem ini".

`app/api/closings/[id]/link/route.ts` owner-only, jadi aman — tapi periksa juga, jangan diasumsikan.

`lead_reports` **tidak** terpengaruh: CS punya policy SELECT di tabel itu, sudah diverifikasi `PATCH` jalan normal. Jangan diubah.

### Verifikasi

```
1. Login sebagai CS di aplikasi, simpan satu closing → harus tersimpan
2. Closing itu muncul di daftar closing CS
3. Sebagai CS: select cost_at_transaction from closings → tetap kosong/ditolak
4. Batalkan closing → bucket di laporan asalnya pulih (trigger T-1)
```

Tambahkan test di `tests/sql/` yang menjalankan insert **sebagai role authenticated**, bukan superuser.

---

## Definition of done

- [ ] `curl` dengan anon key ke `v_closing_enriched` membalas error izin
- [ ] Owner tetap melihat seluruh angka dashboard dengan benar
- [ ] CS tidak melihat `gross_profit` di mana pun
- [ ] CS berhasil menyimpan, mengubah, dan membatalkan closing
- [ ] CS tetap tidak bisa membaca `cost_at_transaction` lewat jalur mana pun
- [ ] Seluruh test SQL lama tetap hijau (`tests/sql/*.sql`)
- [ ] `npm run typecheck` dan `npm test` hijau
- [ ] Test baru dijalankan sebagai role sungguhan, bukan superuser
- [ ] Tidak ada rahasia tertulis di berkas mana pun
