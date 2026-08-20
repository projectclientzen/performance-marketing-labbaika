# Audit Kesesuaian BE ↔ FE — Labbaika Reporting

Tanggal: 20 Agustus 2026
Basis: branch `cc/fix-s0-rls-leak` (commit `3c5ad53` + perubahan belum di-commit di `app/api/closings/*`).
Lingkup: membandingkan apa yang **dikirim/diharapkan FE** (`app/cs/*`, `app/owner/*`, `components/*`) dengan apa yang **diterima/dikembalikan BE** (`app/api/*`, `lib/schemas/*`, `supabase/migrations/*`).
Metode: pembacaan kode menyeluruh dua arah — setiap `apiFetch` di FE ditelusuri ke route, skema Zod, dan constraint/RLS tabelnya. Tidak dieksekusi terhadap database (berbeda dari `07-AUDIT-REPO.md` yang eksekusi nyata).

PRD BE (`04-BRIEF-BE.md`) belum diperbarui setelah FE dibangun, jadi acuan "benar" di dokumen ini adalah **kebutuhan FE**, kecuali di kasus di mana FE yang melanggar invariant data — itu ditandai eksplisit.

Severity mengikuti `07-AUDIT-REPO.md`:
- **S0** = fitur inti mati total atau data sensitif bocor.
- **S1** = error 500 / gagal di alur normal.
- **S2** = fitur tidak lengkap, tidak bikin crash.

---

## Ringkasan

| # | Temuan | Sev | Sisi | Status |
|---|---|---|---|---|
| 1 | Export Center mati total setelah fix S0-01 | S0 | BE | ✅ kode + 021 terpasang di DB, versi pasca-review terkonfirmasi |
| 2 | Closing gagal disimpan kalau email dikosongkan | S0 | BE (schema) | ✅ `30b7bc5` |
| 3 | Closing 500 kalau provinsi/kota tidak dipilih | S0 | BE (schema/route) | ✅ `30b7bc5` |
| 4 | POST /api/closings tidak lagi balas `id` yang dipakai FE | S1 | BE | ✅ `2e4b959` |
| 5 | Insight tidak bisa diedit — DELETE tidak diizinkan | S1 | BE (RLS + grant) | ✅ `9a9d744`; 022 terpasang **dan terverifikasi di live** dengan JWT GoTrue asli |
| 6 | Insight tidak bisa dikosongkan | S2 | BE | ✅ `d4334cd` |
| 7 | Laporan harian bisa dikirim dengan "sisa" > 0, ditolak DB | S1 | FE + BE (schema) | ✅ `a84a1ab` |
| 8 | `saved.reduce()` crash kalau batch balas array kosong | S1 | FE | ✅ `fef30c3` |
| 9 | `/cs/performa` kirim tanggal `-31` untuk semua bulan | S1 | FE | ✅ `74e1006` |
| 10 | Tidak ada `GET /api/lead-reports/:id` — koreksi H-7 mustahil | S2 | BE + FE | ⬜ |
| 11 | Reconciliation tidak punya tombol tautkan | S2 | FE | ⬜ |
| 12 | CS tidak bisa melihat / mengubah / membatalkan closing | S2 | FE | ⬜ |
| 13 | `brand_settings` tanpa halaman — break-even CPP tak bisa diatur | S2 | FE | ⬜ |
| 14 | Import ads level adset/ad selalu gagal | S2 | FE atau BE | ⬜ |
| 15 | Tidak ada cara menambah user baru | S2 | BE | ⬜ |
| 16 | `error.message` mentah masih dikirim di ~15 route | S1 | BE | ✅ `17edd27` (16 route) + `9a9d744` (sisa) |
| **20** | **HPP/gross profit di luar lingkup — sistem diformulasikan ulang di atas omset** | perubahan lingkup | DB+BE+FE | ✅ kode selesai (`93b328f` DB, `4b9d995` BE, `684280d` FE) — **migrasi 023 belum dijalankan ke database** |
| 19 | `app_users` kosong — belum ada owner/CS, aplikasi belum bisa dipakai siapa pun | S1 | ops | ⬜ terhalang #15 (tidak ada `POST /api/users`) |
| 17 | Daftar "CS belum lapor" ikut memuat CS non-aktif | S2 | FE | ⬜ |
| **18** | **Harness `tests/sql/*` tidak pernah mengaktifkan identitas — seluruh assertion per-role tidak sahih** | **S1** | test | ⬜ 021 sudah benar, 14 berkas lain belum |

### Status per 20 Agustus 2026

Seluruh perbaikan sudah ter-push ke `origin/cc/fix-s0-rls-leak`, kini di `a08c0c3`:
`229ecd6` + `e7689a7` + `22c5afe` (#1), `30b7bc5` (#2/#3), `2e4b959` (#4), `9a9d744` (#5/#16),
`d4334cd` (#6), `74e1006` (#9), `fef30c3` (#8), `a84a1ab` (#7), `17edd27` (#16 sisa, via `ds/fix-s1-s2` merge `21fbcb9`), `a08c0c3` (#18 test harness).

### Keadaan database live (diperiksa 20 Agustus, lewat REST + anon key)

**Koreksi:** catatan sebelumnya di dokumen ini menyebut migrasi 021 belum dijalankan.
Itu keliru — sudah diperiksa langsung ke project dan 021 **sudah terpasang**.

Project `ymnttmqfwzrhqpnewbeo` hidup dan berisi. Hasil probe:

| Objek | Hasil probe sebagai `anon` | Kesimpulan |
|---|---|---|
| `regions` | balas data (Aceh, dst) | migrasi 001 + seed regions terpasang |
| `v_closing_enriched` | `42501 permission denied for view` | **019 terpasang dan bekerja** — kebocoran S0-01 tertutup |
| `v_closings_cs` | `42501 permission denied for view` | 019 terpasang |
| `get_dashboard_overview` | `42501 permission denied for function` | ada, EXECUTE anon dicabut |
| `get_campaign_quality` | `42501` | ada, EXECUTE anon dicabut |
| `get_cs_performance` | `42501` | ada, EXECUTE anon dicabut |
| `get_lead_insight_summary` | `42501` | ada, EXECUTE anon dicabut |
| `get_export_operational` | `42501` | **021 terpasang** |
| `get_export_meta_ltv` | `42501` | **021 terpasang** |

Catatan penting: probe hanya membuktikan fungsinya **ada**, bukan **versi mana**. Kalau 021
dijalankan sebelum `e7689a7`, fungsi yang tertanam di database belum punya tiebreaker
`, c.id` — dan itu tidak bisa diperbaiki dengan push kode, harus `create or replace` ulang.
Perlu dipastikan dengan `psql`.

**022 sudah terverifikasi di live** (sesi `-77`, JWT GoTrue asli lewat PostgREST, bukan
simulasi psql): CS A menghapus insight miliknya sendiri (`*/1`), menyimpan ulang berhasil
(HTTP 201 — inilah yang dulu 500 duplicate-key), CS B gagal menghapus milik CS A (`*/0`),
state akhir sesuai. Seluruh data uji dibersihkan; kuverifikasi ulang dari sisiku:
`insight_categories` kembali 15 baris, tidak ada residu `022livetest`, dan seluruh tabel
transaksional (`closings`, `lead_reports`, `lead_report_insights`, `programs`) di 0 baris.

Isi database live per 20 Agustus: `regions` 552, `lead_sources` 6, `insight_categories` 15
(sesuai §6), `brands` 1, **`app_users` 0**.

**Seluruh objek DB sudah dicocokkan dengan HEAD** (diperiksa sesi `-99` lewat `pg_proc`
dan `role_table_grants`, read-only):

| Objek | Versi di live | Bukti |
|---|---|---|
| `get_export_operational` | pasca-review — **punya tiebreaker `, c.id`** | `prosrc` |
| `get_export_meta_ltv` | pasca-review — punya `, c.id` | `prosrc` |
| `get_dashboard_overview` | versi 019, guard `current_brand_id()`, `security_definer` | `prosrc` + `prosecdef` |
| `get_campaign_quality` | idem | idem |
| `get_cs_performance` | idem | idem |
| `get_lead_insight_summary` | idem | idem |
| `v_closings_cs` | `authenticated` punya grant write — **020 terpasang** | `role_table_grants` |

Kekhawatiran "versi 021 pra-review tertanam di DB" **tidak terbukti** — apply dilakukan
setelah `e7689a7`, jadi tidak perlu `create or replace` ulang. Tidak ada selisih tersisa
antara isi git dan isi database.

---

## 19. S1 — `app_users` kosong: belum ada satu pun pengguna

`brands` berisi 1 baris, tapi `app_users` 0. Artinya belum ada owner maupun CS. Siapa pun
yang login akan dapat `NOT_FOUND "Profil pengguna tidak ditemukan"` dari `/api/me`, dan
seluruh RLS mengembalikan nol baris karena `current_brand_id()` bernilai NULL.

Ini juga yang menghalangi verifikasi per-role apa pun terhadap live tanpa membuat pengguna
sementara lebih dulu.

Terhalang temuan #15: `/api/users` tidak punya `POST`, jadi pengguna pertama harus dibuat
lewat dashboard Supabase (Authentication → Add user), lalu barisnya dimasukkan manual ke
`app_users` dengan `brand_id` milik brand yang ada dan `role = 'owner'`.

`npm run typecheck` dan `npm test` hijau (84 test).

**Test statis tidak cukup untuk dua migrasi ini.** 021 dan 022 seluruhnya soal GRANT,
SECURITY DEFINER, dan perilaku RLS — persis kelas kesalahan yang lolos dari Vitest dan
`tsc`, dan persis cara S0-01 dan S0-02 dulu ketahuan. `tests/sql/021_export_access.sql`
dan `tests/sql/022_insight_cs_delete.sql` sudah ditulis dengan role sungguhan; keduanya
masih perlu dijalankan ke project live.

Tiga temuan review terhadap `229ecd6` (paginasi tanpa tiebreaker, error export ditelan
jadi CSV sukses, `p_status` enum disuapi input mentah) sudah ditutup di `e7689a7`.
Tersisa satu catatan kecil di §1.

---

## 1. S0 — Export Center mati total (regresi dari fix S0-01)

**Lokasi:** `app/api/exports/operational/route.ts:54`, `app/api/exports/meta-ltv/route.ts:44`, `supabase/migrations/019_fix_view_grants.sql:19`.

Migrasi 019 mencabut akses view yang membawa HPP/PII:

```sql
revoke all on v_closing_enriched from anon, authenticated;
```

Tapi kedua route export membaca view itu lewat klien Supabase milik pemanggil:

```ts
const { user, appUser, supabase } = await getAuthedAppUser();
...
supabase.from("v_closing_enriched").select("*")
```

`lib/supabase/server.ts` membuat klien dengan `NEXT_PUBLIC_SUPABASE_ANON_KEY` + cookie sesi, jadi role Postgres-nya `authenticated` — persis role yang baru saja dicabut haknya. Owner menekan dua tombol di `app/owner/export/page.tsx` dan dapat error, bukan CSV.

Ini bukan cacat di migrasi 019 — 019 benar. Yang belum ikut disesuaikan adalah route yang masih menganggap dirinya boleh membaca view itu langsung.

**Fix (pilih satu, konsisten dengan pola yang sudah dipakai 019):**

- **Opsi A (sejalan dengan analitik):** bikin `get_closing_export(p_brand_id, p_from, p_to, ...)` sebagai `security definer` dengan guard `p_brand_id <> current_brand_id()` **dan** guard `current_app_role() = 'owner'` — export membawa kolom biaya, jadi guard role wajib, tidak cukup guard brand seperti empat fungsi di 019. Route memanggil RPC, paginasi lewat `p_offset`/`p_limit`.
- **Opsi B (lebih cepat):** pakai klien service-role khusus di dua route ini saja, setelah pengecekan `appUser.role !== "owner"` yang sudah ada. Risikonya: RLS tidak lagi jadi jaring pengaman, seluruh beban jatuh ke pengecekan di route.

Rekomendasi: **Opsi A**. Opsi B memindahkan satu-satunya penjaga HPP ke `if` di TypeScript.

**Verifikasi:** login sebagai owner, unduh kedua CSV, harus berisi baris. Lalu panggil endpoint yang sama sebagai CS — harus 403.

### Sisa yang belum dibereskan di `229ecd6`

Opsi A dipakai (fungsi `security definer` terguard). Guard-nya benar — brand **dan**
role owner, lebih ketat dari empat fungsi di 019, dan itu tepat karena baris export
membawa PII mentah. Nama kolom `returns table` cocok dengan accessor di
`lib/exports/operational/columns.ts` dan `buildMetaRow`. Filter `pdp_consent` dan
`cancelled` pindah ke SQL. Tiga hal tersisa:

**1a. Paginasi tanpa tiebreaker.** `order by c.closing_date desc offset p_offset limit p_limit`
di kedua fungsi. `closing_date` jauh dari unik. Postgres tidak menjamin urutan antar
baris seri, dan `OFFSET` mengeksekusi ulang query tiap halaman — baris bisa muncul dua
kali di halaman berbeda sementara baris lain tidak pernah keluar. Di export 50.000 baris
ini hampir pasti terjadi. Sudah laten sejak versi `.range()` sebelumnya, jadi bukan
regresi baru, tapi migrasi ini tempat yang tepat menutupnya: `order by c.closing_date desc, c.id`.

**1b. Error export ditelan jadi CSV yang terlihat sukses.** Kedua route:
`if (error || !data || data.length === 0) break;` — error apa pun mengakhiri loop, lalu
`controller.close()` mengirim HTTP 200 dengan CSV berisi baris yang sempat terambil
(bisa nol, hanya header). `export_logs.row_count` ikut mencatat angka terpotong itu
seolah normal. Owner tidak punya cara membedakan export utuh dari export terpotong, dan
bisa mengambil keputusan dari angka yang tidak lengkap. Fix `229ecd6` justru menambah
dua jalur exception baru (guard brand, guard role), jadi peluangnya naik. Pisahkan error
dari habis-data, dan gagalkan stream-nya secara terang-terangan.

**Semua sudah ditutup di `e7689a7`:** tiebreaker `, c.id` di kedua fungsi; error
dipisah dari habis-data lewat `controller.error()` sehingga unduhan putus terang-terangan
alih-alih menghasilkan CSV terpotong ber-HTTP 200; `status` divalidasi di route jadi 422.

Satu catatan kecil tersisa: validasinya memakai `status in PAYMENT_STATUS`. Operator `in`
ikut menghitung properti prototipe, jadi `{"status":"constructor"}` lolos validasi
(`'constructor' in PAYMENT_STATUS` bernilai `true`). Tidak berbahaya lagi sekarang —
fix 1b membuatnya gagal terang-terangan di Postgres, bukan diam-diam — tapi seharusnya
422 yang rapi. Ganti ke `Object.hasOwn(PAYMENT_STATUS, status)`.

**1c. `p_status` bertipe enum, disuapi input mentah.**
`app/api/exports/operational/route.ts:38` membaca `body.status` tanpa validasi lalu
meneruskannya ke parameter bertipe `payment_status`. Nilai di luar enum memicu
`invalid input value for enum payment_status` — yang, karena 1b, keluar sebagai CSV
kosong ber-HTTP 200. Validasi di route (Zod terhadap nilai enum yang sah) supaya jadi
422 yang berguna.

---

## 2. S0 — Closing gagal disimpan kalau email dikosongkan

**Lokasi:** `lib/schemas/closing.ts:34`, `app/cs/closing/page.tsx:62` & `:200`.

FE menandai email sebagai opsional (`placeholder="Email (opsional)"`) dan menyimpannya di state sebagai string kosong:

```ts
const [form, setForm] = useState({ ..., email: "", ... });
```

Body dikirim dengan `...form`, jadi `email: ""` selalu ikut. Skema BE:

```ts
email: z.string().email('Email tidak valid').optional(),
```

`.optional()` hanya mengizinkan field **tidak ada**. String kosong itu ada, dan gagal `.email()`. Akibatnya setiap CS yang tidak mengisi email dapat `VALIDATION_ERROR` dengan pesan "Email tidak valid" di field yang dia sengaja kosongkan.

Kolom `closings.email` sendiri nullable (`004_closings.sql:23`) — jadi ini murni ketidakcocokan skema, bukan aturan bisnis.

**Fix (BE, di `lib/schemas/closing.ts`):**

```ts
const emptyToUndefined = (v: unknown) => (v === '' ? undefined : v);

email: z.preprocess(emptyToUndefined, z.string().email('Email tidak valid').optional()),
```

Pola yang sama diperlukan untuk `last_name`, `price_note`, dan `campaign_id` — semuanya opsional di DB dan semuanya dikirim FE sebagai `""`.

---

## 3. S0 — Closing 500 kalau provinsi/kota tidak dipilih

**Lokasi:** `lib/schemas/closing.ts:57-58`, `app/cs/closing/page.tsx:355` & `:367`, `supabase/migrations/004_closings.sql:52-53`.

Dua `<select>` lokasi punya opsi kosong sebagai default:

```tsx
<option value="">Pilih provinsi</option>
```

Skema BE menerimanya tanpa keluhan:

```ts
province_id: z.string().optional(),
city_id: z.string().optional(),
```

`""` lolos karena `z.string()` tidak punya `.min(1)`. Nilai itu diteruskan apa adanya ke insert:

```ts
province_id: parsed.data.province_id,
```

dan `closings.province_id` adalah `text references regions (id)`. Tidak ada baris `regions` dengan id `""`, jadi Postgres menolak dengan pelanggaran foreign key. Route memetakan itu ke `INTERNAL_ERROR` 500.

Ini lebih buruk dari temuan #2: #2 memberi pesan validasi yang menyesatkan, ini memberi error 500 tanpa petunjuk sama sekali.

**Fix (BE):**

```ts
province_id: z.preprocess(emptyToUndefined, z.string().optional()),
city_id: z.preprocess(emptyToUndefined, z.string().optional()),
```

Tambahan yang layak: validasi silang bahwa `city_id` benar-benar anak dari `province_id`. FE sudah memfilter daftar kota berdasarkan `parent_id`, tapi tidak ada apa pun di BE yang mencegah pasangan yang tidak nyambung dikirim langsung ke API.

---

## 4. S1 — `POST /api/closings` tidak lagi mengembalikan `id`

**Lokasi:** `app/api/closings/route.ts:145` (perubahan belum di-commit), `app/cs/closing/page.tsx:127`.

Fix S0-02 membuang `.select()` supaya insert tidak jadi `INSERT ... RETURNING` — itu benar dan memang perlu. Tapi respons ikut berubah:

```ts
return NextResponse.json(ok({ saved: true }));
```

FE masih mengetik dan memakai bentuk lama:

```ts
const data = await apiFetch<{ id: string }>("/api/closings", { ... });
if (data) router.push("/cs");
```

Hari ini tidak crash — `{ saved: true }` tetap truthy, jadi redirect jalan — tapi tipe TypeScript-nya bohong, dan begitu FE butuh id (buka detail closing, tampilkan sheet insight, tautkan ke laporan) tidak ada yang bisa dipakai.

**Fix (BE):** buat id di route dan sertakan dalam insert, sehingga tidak perlu `RETURNING` tapi id tetap diketahui:

```ts
const id = crypto.randomUUID();
const { error, count } = await supabase.from("closings").insert({ id, ... }, { count: "exact" });
...
return NextResponse.json(ok({ id }));
```

Berlaku sama untuk `PATCH /api/closings/:id` dan `POST /api/closings/:id/cancel`, yang sekarang balas `ok({ id })` — bentuk itu sudah benar, cukup dipertahankan.

---

## 5. S1 — Insight tidak bisa diedit: DELETE tidak diizinkan di dua lapis

**Lokasi:** `app/api/lead-reports/[id]/insights/route.ts:70`, `supabase/migrations/013_rls.sql:119-142`, `supabase/migrations/003_lead_reports.sql:57`.

Route insight memakai strategi replace-all:

```ts
await supabase.from("lead_report_insights").delete().eq("lead_report_id", id).in("stage", stages);
// lalu insert set yang baru
```

Policy yang ada untuk `lead_report_insights`: `owner_all`, `cs_own` (SELECT), `cs_insert` (INSERT), `cs_update` (UPDATE). **Tidak ada policy DELETE untuk CS.** RLS tidak melempar error saat DELETE ditolak — baris yang tidak lolos policy hanya tidak ikut terhapus. Jadi `delete()` sukses tapi menghapus 0 baris, lalu `insert()` menabrak:

```sql
create unique index lead_report_insights_uniq
  on lead_report_insights (lead_report_id, stage, category_id);
```

→ 500 dengan pesan duplicate key mentah.

Simpan pertama berhasil (belum ada baris lama). Setiap perbaikan insight sesudahnya gagal. `components/InsightSheet.tsx` muncul otomatis setelah laporan tersimpan, jadi jalur ini sering dilewati CS.

Catatan: komentar di `013_rls.sql:145` menyebut "write access for cs happens through the API using the service role". Itu tidak pernah terwujud — semua route memakai klien anon-key milik pemanggil. Komentarnya perlu ikut dikoreksi supaya tidak menyesatkan pembaca berikutnya.

**Koreksi terhadap versi awal temuan ini.** Diagnosis pertama menyebut penyebabnya
hanya policy RLS yang hilang, sehingga terkesan masalah CS saja. Saat dikerjakan
(`9a9d744`) ketahuan penyebabnya **dua lapis**, dan lapis kedua lebih luas:

`013_rls.sql:271-275` memberi `grant select, insert, update` pada `lead_report_insights`
— **tanpa `delete`**. GRANT tingkat tabel diperiksa lebih dulu, sebelum RLS sempat
menyaring baris. Artinya `DELETE` di tabel ini ditolak untuk **seluruh** role
`authenticated`, termasuk **owner** — padahal `lead_report_insights_owner_all` adalah
`FOR ALL` dan seharusnya mencakup delete. Jadi alur replace-all di route itu rusak untuk
owner juga, bukan hanya CS.

**Fix (migrasi 022, dua-duanya diperlukan):**

```sql
create policy lead_report_insights_cs_delete on lead_report_insights for delete
  using (
    brand_id = current_brand_id()
    and exists (select 1 from lead_reports r where r.id = lead_report_id and r.cs_id = auth.uid())
  );

grant delete on lead_report_insights to authenticated;
```

Layak diperiksa terpisah: tabel lain di blok grant yang sama (`brands`, `app_users`,
`lead_sources`, `insight_categories`, `programs`, `program_departures`,
`program_prices`, `lead_reports`, `closings`) juga tidak punya `delete`. Untuk sebagian
itu memang disengaja; untuk `lead_reports` belum jelas apakah disengaja.

---

## 6. S2 — Insight tidak bisa dikosongkan

**Lokasi:** `app/api/lead-reports/[id]/insights/route.ts:68`, `components/InsightSheet.tsx:46`.

FE hanya mengirim kategori dengan `count > 0`. Kalau CS menghapus semua angka, `insights` jadi `[]`, dan route menghitung `stages` dari isi payload:

```ts
const stages = [...new Set(parsed.data.insights.map((i) => i.stage))];
if (stages.length > 0) { /* delete */ }
```

Array kosong → tidak ada stage → tidak ada yang dihapus → baris lama tetap tersimpan. CS tidak punya cara membatalkan insight yang salah kirim.

**Fix (BE):** terima daftar stage yang ingin ditulis ulang secara eksplisit, terlepas dari isi `insights`:

```ts
const putSchema = z.object({
  stages: z.array(z.enum(["cold","consultation","offering","closing"])).optional(),
  insights: z.array(insightSchema),
});
const stages = parsed.data.stages ?? [...new Set(parsed.data.insights.map((i) => i.stage))];
```

FE kirim `stages: ["consultation","offering"]` — dua tab yang memang dia kelola.

---

## 7. S1 — Laporan harian bisa dikirim dengan "sisa" > 0, lalu ditolak DB

**Lokasi:** `app/cs/laporan/page.tsx:114` & `:196`, `lib/schemas/report.ts:22`, `supabase/migrations/003_lead_reports.sql:33`.

Constraint database menuntut kesamaan persis:

```sql
constraint lead_reports_sum_check
  check (cold + consultation + offering + closing = total_lead)
```

Skema Zod hanya menolak kalau **melebihi**:

```ts
if (sum > val.total_lead) { /* error */ }
```

FE menampilkan sisa sebagai peringatan berwarna, tapi tombol Simpan tetap aktif:

```tsx
<span className={sisa === 0 ? "..." : "font-mono text-warn"}>
  Sisa belum dikategorikan: {sisa}
</span>
```

Jadi CS bisa mengirim `total_lead=10, cold=3, consultation=2, offering=1`, dan baru tahu ditolak setelah request bolak-balik.

**Di sini BE yang benar, bukan FE.** `closing` dikelola trigger T-1 dan bernilai 0 saat insert, jadi kesamaan persis adalah invariant yang memang harus dijaga — "sisa" bukan keadaan yang sah, itu lead yang belum dikategorikan sama sekali.

**Fix (dua-duanya):**

1. BE (`lib/schemas/report.ts`): ubah `sum > val.total_lead` jadi `sum !== val.total_lead`, dengan pesan "cold + consultation + offering harus sama dengan total lead". Aturan jadi hidup di satu tempat, dan error muncul sebagai `VALIDATION_ERROR` per-field, bukan sebagai pesan constraint DB.
2. FE: `disabled={submitting || blocks.some((b) => b.total_lead - (b.cold + b.consultation + b.offering) !== 0)}`.

---

## 8. S1 — `saved.reduce()` crash kalau batch mengembalikan array kosong

**Lokasi:** `app/cs/laporan/page.tsx:82`.

```ts
const primary = saved.reduce((best, r) => ...);   // tanpa nilai awal
```

`reduce` tanpa initial value melempar `TypeError: Reduce of empty array with no initial value`. `create_lead_report_batch` mengembalikan hasil query `where ... idempotency_key like p_idempotency_key || ':%'` — kosong kalau blok tidak jadi tersimpan karena `on conflict do nothing` di jalur idempotency, atau kalau `p_idempotency_key` yang dikirim tidak cocok pola.

Tidak akan sering terjadi, tapi kalau terjadi, CS melihat crash halaman **setelah** datanya sebenarnya tersimpan.

**Fix (FE):**

```ts
const primary = saved.length > 0
  ? saved.reduce((best, r) => (r.consultation + r.offering > best.consultation + best.offering ? r : best))
  : null;
if (primary && primary.consultation + primary.offering > 0) setInsightTarget(primary);
else setTimeout(() => router.push("/cs"), 1200);
```

---

## 9. S1 — `/cs/performa` mengirim tanggal `-31` untuk semua bulan

**Lokasi:** `app/cs/performa/page.tsx:20`.

```ts
apiFetch<LeadReport[]>(`/api/lead-reports?from=${month}-01&to=${month}-31`)
```

Untuk Februari itu jadi `2026-02-31`. Route meneruskannya ke `query.lte("report_date", to)` tanpa validasi, dan Postgres menolak: `date/time field value out of range`. Halaman "Performa saya" jadi mati di Februari, April, Juni, September, dan November.

**Fix (FE):** pakai hari terakhir yang benar — `new Date(y, m, 0).getDate()`. `app/api/reports/monthly/route.ts:8` sudah punya helper `monthRange()` dengan logika ini; layak dipindah ke `lib/utils/date.ts` dan dipakai kedua sisi.

**Fix tambahan (BE):** validasi `from`/`to` dengan `z.string().date()` di GET `/api/lead-reports` supaya tanggal ngawur balas 422, bukan 500.

Catatan kecil di halaman yang sama: "Hari lapor" memakai `reports.length`, padahal satu hari bisa punya beberapa baris (satu per source). Angkanya akan lebih besar dari jumlah hari sebenarnya. Pakai `new Set(reports.map(r => r.report_date)).size`.

---

## 10. S2 — Tidak ada `GET /api/lead-reports/:id`

Sudah dicatat di `07-AUDIT-REPO.md` S2-05 dan masih terbuka. Dari sisi kesesuaian FE↔BE: `PATCH /api/lead-reports/:id` ada dan berfungsi, tapi tidak ada satu pun pemanggil di FE, dan tidak ada endpoint untuk memuat isi laporan lama ke form. Alur koreksi H-7 belum bisa dipakai dari ujung mana pun.

---

## 11. S2 — Reconciliation tidak punya tombol tautkan

**Lokasi:** `app/owner/reconciliation/page.tsx:78-90`, `app/api/closings/[id]/link/route.ts`.

BE sudah lengkap: `POST /api/closings/:id/link` menerima `{ lead_report_id, previous_stage }`, owner-only, dan menangani `STAGE_UNDERFLOW` dari trigger T-1. FE hanya **menampilkan** daftar unlinked closing sebagai teks statis — tidak ada tombol, tidak ada pemilih laporan tujuan.

Artinya panel Reconciliation memberi tahu owner ada masalah tapi tidak memberi cara menyelesaikannya. Ini kebalikan dari temuan lain di dokumen ini: BE-nya siap, FE-nya yang belum menyusul.

**Fix (FE):** per baris, tambah pemilih laporan (`GET /api/lead-reports?cs=<cs_id>&date=<lead_date>`) + pemilih `previous_stage`, lalu POST ke endpoint yang sudah ada.

---

## 12. S2 — CS tidak bisa melihat, mengubah, atau membatalkan closing

Endpoint yang ada tanpa pemanggil FE sama sekali:

| Endpoint | Fungsi | Pemanggil FE |
|---|---|---|
| `GET /api/closings` | daftar closing (CS lewat `v_closings_cs`) | tidak ada |
| `PATCH /api/closings/:id` | koreksi closing | tidak ada |
| `POST /api/closings/:id/cancel` | pembatalan + alasan | tidak ada |
| `GET /api/lead-reports/:id/insights` | muat insight tersimpan | tidak ada |

`v_closings_cs` dibangun khusus supaya CS bisa membaca closing miliknya tanpa kolom biaya — infrastruktur yang tidak terpakai. Setelah menekan Simpan, CS tidak punya jalan melihat apa yang tersimpan, apalagi memperbaikinya.

**Fix (FE):** halaman daftar closing di `/cs`, dengan aksi koreksi dan batal per baris.

---

## 13. S2 — `brand_settings` tanpa halaman

`GET`/`PATCH /api/brand-settings` sudah ada (owner-only) dan mengelola `default_margin_pct` serta `auto_lock_days`. Tidak ada halaman yang memanggilnya.

`default_margin_pct` ikut membentuk **break-even CPP**, yang tampil menonjol di dashboard owner lewat `ThresholdCard` (`app/owner/page.tsx:117`). Tanpa cara mengisinya, angka itu bertumpu pada nilai default database.

**Fix (FE):** satu form kecil di `/owner/settings`.

---

## 14. S2 — Import ads level `adset` dan `ad` selalu gagal

**Lokasi:** `app/owner/settings/import/page.tsx:52`, `app/api/ads/import/route.ts:96-110`, `supabase/migrations/005_ads.sql:30` & `:42`.

FE menyediakan pemilih level dengan empat pilihan, tapi hanya satu input induk:

```ts
body: JSON.stringify({ level, ad_account_external_id: accountExternalId || undefined, rows })
```

Route butuh induk yang berbeda per level:

```ts
} else if (parsed.data.level === "adset") {
  // cari ad_campaigns by parsed.data.ad_campaign_external_id
} else if (parsed.data.level === "ad") {
  // cari ad_sets by parsed.data.ad_set_external_id
}
```

Keduanya tidak pernah dikirim FE, jadi lookup balas null, dan insert stub menabrak kolom `not null`:

```sql
ad_campaign_id uuid not null references ad_campaigns (id),   -- ad_sets
ad_set_id      uuid not null references ad_sets (id),        -- ads
```

Setiap baris masuk ke array `errors`, `imported` selalu 0.

**Fix (pilih satu):**
- FE: tampilkan input `ad_campaign_external_id` saat level `adset`, `ad_set_external_id` saat level `ad`.
- Atau: batasi pemilih level ke `account` dan `campaign` saja sampai UI-nya siap — lebih jujur daripada pilihan yang pasti gagal.

---

## 15. S2 — Tidak ada cara menambah user

`app/api/users/route.ts` punya GET dan PATCH, tanpa POST — komentarnya menyebut pembuatan identitas auth butuh Supabase Admin API dan sengaja ditunda. `app/owner/settings/users/page.tsx` mengikuti: hanya bisa mengubah role dan menonaktifkan.

Konsekuensi operasional: menambah CS baru harus lewat dashboard Supabase, lalu memasukkan baris `app_users` secara manual. F-19 belum utuh.

**Fix (BE):** `POST /api/users` yang memanggil `supabase.auth.admin.createUser()` dengan service-role key (hanya di route ini), lalu menulis baris `app_users` dengan `brand_id` milik owner pemanggil.

---

## 16. S1 — `error.message` mentah masih dikirim ke klien

`07-AUDIT-REPO.md` S1-04 sudah mencatat ini. Perbaikan di working tree baru mencakup tiga route closing. Yang masih mengirim pesan Postgres mentah:

`lead-reports/route.ts` (POST & GET), `lead-reports/[id]/route.ts`, `lead-reports/[id]/insights/route.ts`, `master/[resource]/route.ts`, `price-lookup/route.ts`, `programs/route.ts`, `programs/[id]/{departures,prices,costs}/route.ts`, `dashboard/{overview,campaigns,cs-performance,insights}/route.ts`, `closings/unlinked/route.ts`, `closings/[id]/link/route.ts`, `users/route.ts`, `period-locks/route.ts`, `period-locks/[id]/route.ts`, `audit-logs/route.ts`, `reports/monthly/route.ts`, `brand-settings/route.ts`.

Setelah 019, ini bertambah relevan: guard brand di fungsi analitik melempar `'akses ditolak untuk brand tersebut'`, dan pesan itu akan sampai ke browser apa adanya.

**Fix:** pola yang sama seperti di route closing — `console.error("[api/...]", error)` di server, `fail("INTERNAL_ERROR")` ke klien.

---

## 17. S2 — Daftar "CS belum lapor" ikut memuat CS non-aktif

**Lokasi:** `app/owner/reconciliation/page.tsx:37`.

Daftar seluruh CS diambil dari `/api/dashboard/cs-performance`, yang di baliknya `_get_cs_performance_impl` memfilter `u.brand_id = p_brand_id and u.role = 'cs'` — tanpa `is_active`. CS yang sudah dinonaktifkan lewat halaman Users akan terus muncul sebagai "belum lapor hari ini", selamanya.

**Fix (FE):** ambil roster dari `/api/users` dan saring `is_active && role === 'cs'`. Endpoint itu sudah owner-only dan sudah mengembalikan kedua kolom.

---

## Yang sudah cocok dan tidak perlu disentuh

| Area | Bukti |
|---|---|
| Nama kolom dashboard owner | `Overview`, `CsRow`, `CampaignRow`, `InsightRow` di FE cocok persis dengan `returns table (...)` di migrasi 016/018/019 |
| Amplop respons | `apiFetch` membaca `body.data` / `body.error.{code,message,fields}`; `lib/api/envelope.ts` menghasilkan bentuk itu |
| Alur DUPLICATE_CONFLICT | BE balas 409 + `fields {cs_name, closing_date, program_name}`; FE membacanya lewat `ApiError.fields` dan menawarkan "Tetap simpan" (`force: true`) |
| Masking profit untuk CS | `get_cs_performance` (019) me-null-kan `gross_*` untuk non-owner; `app/cs/performa` memang tidak menampilkannya |
| Master data | `/api/master/{sources,insight-categories,regions}` cocok dengan `TABLE_MAP`; kolom `is_active`/`sort_order` ada di `001` |
| Program & harga | `programSchema`/`departureSchema`/`priceSchema`/`costSchema` cocok dengan kolom di `002`; route menyuntik `program_id` dari path |
| Price lookup | FE membaca `p.price`; `program_prices.price` ada, presedensi departure-spesifik sesuai T-7 |
| Ads import level account/campaign | bentuk baris dan upsert `(brand_id, level, entity_id, date)` cocok |
| Guard route | setiap endpoint owner-only mengecek `appUser.role !== "owner"` sendiri; middleware menjaga halaman `/owner` |

---

## Urutan pengerjaan yang disarankan

1. **#1 Export Center** — regresi yang diperkenalkan fix S0-01 kemarin, dan satu-satunya cara data keluar dari sistem.
2. **#2, #3, #4** — satu berkas skema plus satu route; tanpa ini form closing tidak bisa dipakai CS untuk kasus normal (email kosong, lokasi belum diisi).
3. **#5, #6** — satu migrasi policy plus perubahan kecil di route insight.
4. **#7, #8, #9** — perbaikan kecil di FE, masing-masing berdiri sendiri.
5. **#16** — sapuan mekanis, layak dikerjakan sekaligus sebelum route bertambah banyak.
6. **#10 – #15, #17** — kelengkapan fitur, urut sesuai prioritas produk.

#2, #3, dan #4 menyentuh berkas yang sama (`lib/schemas/closing.ts`, `app/api/closings/route.ts`) dan sedang bertumpuk dengan perubahan S0-02 yang belum di-commit — kerjakan berurutan oleh satu orang, jangan paralel.


---

## 18. S1 — Harness `tests/sql/*` tidak pernah benar-benar berganti identitas

**Ditemukan sesi `-99`** saat menjalankan `tests/sql/021_export_access.sql` ke database
sungguhan; sudah kuverifikasi ulang terhadap seluruh isi `tests/sql/` dan `013_rls.sql`.

**Lokasi:** 7 berkas memakai pola yang salah — `011`, `013`, `016`, `018`, `019`, `020`,
`022`. Hanya `021` yang benar.

### Cacat 1 — `app.test_uid` tidak dibaca siapa pun

Tujuh berkas berganti identitas dengan:

```sql
set role authenticated;
select set_config('app.test_uid', cs_a::text, false) from rls_test_ids;
```

Tapi seluruh RLS bersandar pada `current_brand_id()` dan `current_app_role()`
(`013_rls.sql:20-31`), dan keduanya membaca `auth.uid()`. `auth.uid()` bawaan Supabase
membaca `request.jwt.claim.sub` / `request.jwt.claims` — **bukan** `app.test_uid`. Tidak
ada satu pun migrasi yang menimpa `auth.uid()` dengan shim uji (sudah kucek seluruh
`supabase/migrations/*.sql`).

Jadi setiap `set_config('app.test_uid', ...)` itu no-op. Sepanjang berkas-berkas itu
`auth.uid()` bernilai NULL, sehingga `current_brand_id()` dan `current_app_role()` juga
NULL, apa pun identitas yang dimaksud.

**Akibatnya assertion-nya menyesatkan ke dua arah:**

- Assertion negatif **lulus karena alasan yang salah**. "CS B tidak melihat baris milik CS
  A" memang balas 0 baris — bukan karena isolasi bekerja, tapi karena CS B bukan siapa-siapa.
  Predikat `cs_id = auth.uid()` dengan `auth.uid()` NULL selalu false. Test ini akan tetap
  hijau meskipun policy-nya dihapus seluruhnya.
- Assertion positif **seharusnya gagal**. Di `019_view_grants.sql:81-110` ada
  "owner: full numbers still correct" — dengan `current_brand_id()` NULL, guard
  `if p_brand_id is distinct from current_brand_id()` pasti melempar
  `akses ditolak untuk brand tersebut`. Berkas itu tidak mungkin lulus apa adanya.

### Cacat 2 — identitas uji diambil dari `auth.users` milik orang lain

```sql
insert into auth.users default values;
...
select id into v_cs from auth.users offset 0 limit 1;
```

Dua masalah bertumpuk. `auth.users.id` tidak punya default di project ini (GoTrue yang
membuat id), jadi `insert ... default values` melanggar NOT NULL. Dan `offset` tanpa
`order by` tidak menjamin urutan apa pun — di database yang sudah punya user asli, baris
yang terambil bisa **user sungguhan**, bukan yang baru dibuat test.

Pola ini ada di 15 berkas. `021` sudah memakai bentuk yang benar:

```sql
insert into auth.users (id) values (gen_random_uuid()) returning id into v_owner;
```

### Kenapa ini penting melebihi test yang biasa

Seluruh model keamanan sistem ini adalah RLS. `tests/sql/` satu-satunya tempat RLS diuji —
Vitest hanya menyentuh fungsi murni di `lib/`, dan CI tidak menjalankan berkas SQL sama
sekali. Selama harness-nya tidak mengaktifkan identitas, tidak ada satu pun bukti otomatis
bahwa isolasi antar-CS, penyembunyian HPP, atau guard brand benar-benar bekerja.

Ini juga menjelaskan kenapa S0-01 dan S0-02 lolos berbulan-bulan: `07-AUDIT-REPO.md`
menyebut "semua pengujian sebelumnya dijalankan sebagai superuser". Diagnosis itu benar
arahnya tapi belum sampai ke akarnya — bukan cuma soal superuser, harness-nya memang tidak
pernah punya cara berganti identitas.

### Yang masih berdiri dan yang tidak

**Masih berdiri:** penutupan kebocoran S0-01. Diverifikasi lewat jalur terpisah (curl +
anon key ke REST) oleh Sonnet saat mengerjakannya, dan kuulangi sendiri 20 Agustus —
`v_closing_enriched` balas `42501 permission denied for view`. Itu bukti dari sistem
sungguhan, tidak bergantung pada harness.

**Belum tentu berdiri:** assertion per-role di `019` (owner tetap dapat angka, CS dapat
profit ter-masking), `020` (CS bisa update closing-nya sendiri, CS lain tidak bisa), dan
`022` (CS bisa mengganti insight-nya sendiri). Sonnet menyebut verifikasi S0-02 memakai
JWT GoTrue asli lewat REST — kalau benar, itu jalur sah dan terpisah dari berkas `.sql`;
perlu dipastikan, bukan diasumsikan salah.

### Koreksi (setelah klarifikasi sesi `-77`)

Diagnosis di atas benar untuk **database live**, tapi tidak lengkap. `-77` menjalankan
berkas-berkas itu di Postgres lokal yang tidak punya schema `auth` sama sekali, jadi
mereka membuat bootstrap sendiri sebelum apply migrasi:

```sql
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key default gen_random_uuid());
create or replace function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('app.test_uid', true), '')::uuid $$;
```

Di lingkungan itu `auth.uid()` memang membaca `app.test_uid`, `auth.users.id` punya
default, dan pola `insert ... default values` + `offset` aman karena databasenya kosong.
Jadi assertion mereka **sahih untuk logika policy** — bukan lulus vakum.

**Cacat sebenarnya bukan isi berkasnya, tapi bahwa prasyaratnya tidak ada di repo.**
Bootstrap itu tidak pernah di-commit, sehingga:

- berkas `tests/sql/*` tidak bisa direproduksi siapa pun selain penulisnya;
- dijalankan terhadap Supabase sungguhan — satu-satunya lingkungan yang benar-benar
  penting — ketujuh berkas itu **diam-diam merosot jadi no-op**, karena `auth.uid()`
  bawaan Supabase tidak pernah melihat `app.test_uid`. Terbukti empiris: TEST 2 milik
  `-99` di berkas 021 kena brand-guard (NULL) alih-alih role-guard yang dimaksud;
- tidak ada yang gagal keras saat itu terjadi. Assertion negatif tetap hijau, hanya
  karena identitasnya NULL.

Test yang hijau di laptop satu orang dan tidak sahih di produksi lebih berbahaya daripada
test yang tidak ada, karena dibaca sebagai jaminan.

**Fix yang disarankan:** commit bootstrap-nya ke repo (mis. `tests/sql/000_bootstrap.sql`)
**dan** samakan sumber identitasnya dengan produksi — definisikan stub `auth.uid()` supaya
membaca `request.jwt.claim.sub`, lalu pakai `set_config('request.jwt.claim.sub', ...)` di
semua berkas. Dengan begitu satu pola berjalan sama di lokal maupun di Supabase, dan tidak
ada lagi jalur di mana test merosot jadi no-op tanpa suara.

Alternatif minimal: ganti `set_config('app.test_uid', ...)` jadi `set_config('request.jwt.claim.sub', ...)`
dan pola `insert ... default values` + `offset` jadi `insert into auth.users (id) values
(gen_random_uuid()) returning id` di ketujuh berkas. Lalu jalankan ulang semuanya — dan
perlakukan berkas mana pun yang berubah dari hijau jadi merah sebagai temuan baru, bukan
sebagai test yang rusak.


---

## 20. Perubahan lingkup — HPP dan gross profit dibuang, metrik pindah ke omset

Bukan temuan bug. Ini keputusan pemilik produk yang membatalkan sebagian asumsi
`02-PRD-v1.3.md` dan `04-BRIEF-BE.md`, dicatat di sini supaya jejaknya jelas.

**Keputusan (Maszen, 20 Agustus 2026):**

> "harusnya gak ada gross, fokus ke omset karena aku gak handle hpp … aplikasi ini cuma
> buat ngukur efektivitas iklan dan cs serta melihat roi atau roas yang dihasilkan dari
> iklan … cuma ada revenue aja"

Pemiliknya advertiser, bukan bagian keuangan. Aplikasi ini alat koordinasi dengan CS dan
pelaporan efektivitas iklan ke owner. Harga program masuk lingkup; HPP program tidak.

**Kenapa HPP sempat ada.** PRD dan brief BE membawanya sejak draft awal. Prototype FE
(`docs/labbaika-reporting.html`) ikut menampilkan kolom Gross Profit, Break-even CPP, dan
chip `estimasi` bertooltip "78% revenue sudah terisi HPP-nya" — tapi tidak punya satu pun
layar untuk *mengisi* HPP. Itu petunjuk paling kuat bahwa HPP masuk lewat dokumen, bukan
lewat kebutuhan: angkanya ditampilkan, inputnya tidak pernah dirancang.

**Kenapa tidak cukup dibiarkan kosong.** Menyimpan kolom biaya yang selamanya NULL bukan
pilihan netral. `gross_profit` adalah kolom generated `total_value - coalesce(cost,0)*pax`,
jadi tanpa HPP nilainya sama dengan omset — dan `margin_pct` selalu 100%, `roi` salah
besar, `breakeven_cpp` salah. Dashboard akan menampilkan angka yang salah secara diam-diam.

### Formulasi ulang

| Metrik | Dulu (berbasis HPP) | Sekarang (berbasis omset) |
|---|---|---|
| `roi` | `(gross_profit − spend) / spend` | `(omset − spend) / spend` |
| `roas` | — | `omset / spend` (baru, diminta eksplisit) |
| `breakeven_cpp` | `gross_profit / closing` | `omset / closing` |
| `net_revenue` | `net_contribution` = `gross_profit − spend` | `omset − spend` |
| `ad_cost_ratio` | `spend / omset` | tidak berubah |
| `cpp` | `spend / closing` | tidak berubah |
| `gross_profit`, `margin_pct`, `cost_coverage_rate` | ada | **dihapus** |

Nama `breakeven_cpp` sengaja dipertahankan karena artinya justru jadi lebih lurus: tanpa
HPP, titik impas biaya per closing memang sama dengan harga jualnya. Terbukti di fixture
`tests/sql/016`: `breakeven_cpp` keluar 32.900.000 untuk kedua campaign, persis harga
paketnya. `cppStatus()` di FE tidak perlu berubah.

Nama kolom lain dipertahankan persis. Pelajaran dari export minggu ini: nama field yang
meleset menghasilkan kolom kosong tanpa error apa pun.

### Yang dibuang

**Database (migrasi 023):** tabel `program_costs`; kolom `closings.cost_at_transaction`,
`cost_source`, `cost_of_sales`, `gross_profit`; tipe `cost_source`; trigger T-7
`lock_cost_at_transaction` beserta fungsinya; `brand_settings.default_margin_pct`.
`v_closing_enriched` dan keempat fungsi analitik dibangun ulang.

Migrasi `008_trigger_cost_lock.sql` **tetap di riwayat** — sudah pernah dijalankan ke
database live, jadi tidak boleh dihapus. 023 yang membatalkannya.

**BE:** `app/api/programs/[id]/costs/route.ts`, `costSchema` di `lib/schemas/program.ts`,
`default_margin_pct` di `app/api/brand-settings/route.ts`, `cost_coverage_rate` di meta
`app/api/dashboard/overview/route.ts`, seluruh matematika biaya di `lib/utils/profit.ts`.

**FE (`684280d`):** kartu "Gross Profit" → "Omset", chip `estimasi` pada ROI dihapus,
kolom Gross Profit di tabel campaign dan CS diganti omset, dan seluruh bagian input HPP di
`app/owner/programs/page.tsx` dibuang.

**Test:** `tests/sql/008_cost_lock.sql` dihapus (menguji trigger yang sudah tidak ada).
`004`, `013`, `016`, `019`, `020`, `021` disesuaikan.

### Dua kebocoran yang sekalian ditutup di 023

Keduanya ditemukan saat menelusuri fungsi analitik untuk perubahan ini, dan diperbaiki di
migrasi yang sama karena menyentuh fungsi yang persis sama.

**20a. Angka se-brand bocor ke CS.** `get_dashboard_overview`, `get_campaign_quality`, dan
`get_lead_insight_summary` hanya menjaga brand, tidak menjaga role, sementara EXECUTE-nya
diberikan ke `authenticated`. Route menolak non-owner, tapi guard itu hanya hidup di
TypeScript — CS yang sudah login bisa memanggil RPC-nya langsung dari browser dengan anon
key dan menarik omset serta spend se-brand. 023 menambahkan guard `role = owner`.

**20b. Antar-CS bisa saling melihat.** `get_cs_performance` mengembalikan baris **setiap**
CS ke pemanggil mana pun dalam brand; penyaringan per-CS dilakukan di
`app/api/dashboard/cs-performance/route.ts`. Lewat pemanggilan RPC langsung, seorang CS
bisa membaca nama, funnel, jumlah closing, dan tingkat pembatalan rekannya. Pemilik
menyatakan eksplisit bahwa antar-CS tidak boleh saling melihat, jadi 023 memindahkan
penyaringannya ke dalam fungsi. Filter di route dipertahankan sebagai lapis kedua.

### Status kode: selesai

| Bagian | Commit |
|---|---|
| DB — migrasi 023, rollback, `tests/sql` | `93b328f` |
| BE — schema, route, `lib/utils/profit.ts` | `4b9d995` |
| FE — lima layar owner | `684280d` |

`npm run lint` (0 error), `typecheck`, dan 85 test hijau.

### Belum selesai

- **Migrasi 023 belum dijalankan ke database.** Ini yang paling penting. Sampai dijalankan,
  kode dan database tidak sinkron: FE dan API sudah meminta `gross_booking_value`, `roas`,
  serta `net_revenue`, sementara fungsi di database masih versi lama yang mengembalikan
  `gross_profit`. Dashboard owner akan menampilkan nilai kosong. Butuh izin eksplisit
  Maszen — menjalankan migrasi ke produksi adalah tindakan tersendiri, bukan turunan dari
  izin commit atau push.
- `02-PRD-v1.3.md` dan `04-BRIEF-BE.md` masih memuat HPP di §4, §11, F-13a. Dokumen sumber
  perlu menyusul, kalau tidak pembaca berikutnya akan membangun ulang HPP dari sana.
- Role `advertiser` (advertiser + owner satu akses) belum ditambahkan. Sengaja ditunda
  sampai 023 mendarat, karena menambah nilai enum `user_role` lebih murah dilakukan
  sekarang selagi `app_users` masih kosong.
