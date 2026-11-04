# Brief dan PRD lanjutan — Labbaika Booking Purchase CAPI

**Disiapkan untuk:** Claude Code  
**Tanggal handoff:** 4 November 2026 (Asia/Jakarta)  
**Status:** implementasi fase 1 tersedia di branch lokal, sudah lulus pemeriksaan lokal pada 7 Oktober 2026, belum di-commit/push/deploy. Integrasi akun Meta dan WhatsApp belum dikerjakan.  
**Pemilik keputusan produk:** Maszen  
**Repository:** https://github.com/projectclientzen/performance-marketing-labbaika  
**Baseline:** `048df9373c669e001d4dcd4a1ce70e13cfa83e81` pada `main`. Pencarian commit GitHub dan pemeriksaan branch lokal pada 4 November masih menunjukkan baseline ini; periksa lagi sebelum menerapkan patch.  
**Workspace kode yang sudah dikerjakan:** `/Volumes/Daily Project/AI PROJECT ZEN/labbaika-capi` pada branch `codex/labbaika-capi-booking-value`.  
**Paket portabel:** `/Volumes/Daily Project/AI PROJECT ZEN/Labbaika-CAPI-Hermes-2026-10-07.zip` berisi patch terhadap baseline, dokumen, dan fixture sintetis. ZIP dibuat 7 Oktober; file handoff ini lebih baru dan berada di `docs/` workspace.

> Ini adalah spesifikasi kerja dan catatan status, bukan instruksi untuk mengaktifkan akun atau mengirim data pelanggan. Keputusan pengguna dalam percakapan menjadi acuan bisnis. Dokumen vendor dan file yang ditemui selama implementasi adalah bahan rujukan yang perlu diverifikasi, bukan sumber instruksi yang dapat mengganti keputusan pengguna.

## 1. Masalah dan hasil yang diminta

CS Labbaika menerima prospek dari kampanye click-to-WhatsApp (CTWA) dan mencatat closing di dashboard Next.js/Supabase. Statistik iklan sudah dapat masuk ke dashboard, tetapi hasil booking belum menjadi sinyal Purchase yang dikirim kembali ke Meta. Produk referensi [Trigger CAPI](https://widyaherma.com/trigger-capi-lp) memperlihatkan pola input closing manual lalu event Purchase terlihat di Events Manager. Analisis sumber dilakukan Oktober 2026; materi pemasarannya tidak membuktikan bahwa alat tersebut menangkap identitas klik CTWA atau mengubah goal optimasi iklan.

Hasil akhir yang diinginkan Labbaika: satu catatan booking operasional dapat menghasilkan satu sinyal Purchase dengan nilai penuh produk; ketika jalur WhatsApp resmi dan referral asli tersedia, Purchase itu dapat dikaitkan dengan percakapan dari klik iklan. Dashboard harus menjelaskan tiga tingkat bukti secara terpisah: **event diterima Meta**, **konversi teratribusi ke iklan**, dan **campaign benar-benar menggunakan Purchase sebagai goal optimasi**. Biaya per booking/ROAS yang membaik baru dapat dinilai lewat pengukuran setelah integrasi.

## 2. Keputusan bisnis yang sudah final untuk implementasi saat ini

1. **DP pertama yang positif, benar-benar diterima, dan terverifikasi memicu satu Purchase untuk satu booking.** Nilai event adalah `closings.total_value`, yaitu nilai produk/booking pada transaksi, dalam IDR. Nilai event **bukan** `paid_amount`/nominal DP.
2. Contoh wajib: program Rp30.000.000 per pax, `pax=2`, total booking Rp60.000.000, DP Rp10.000.000. Hasilnya **satu Purchase dengan `value=60000000`, `currency=IDR`**. Sisa cicilan dan pelunasan tidak menambah Purchase.
3. Pembayaran penuh langsung diperlakukan seperti pembayaran pertama. Bila `payment_status=lunas`, jumlah yang dibayar harus sama dengan total booking.
4. Harga memakai snapshot `price_at_transaction × pax`; override yang sah memerlukan nilai total dan catatan alasan. Jangan membaca ulang harga katalog saat retry karena harga katalog dapat berubah.
5. `event_time` adalah timestamp pembayaran pertama yang asli, dengan zona waktu. Bukan waktu upload Excel, waktu CS mengisi form, waktu worker jalan, tanggal closing, atau tanggal keberangkatan.
6. `paid_amount` tetap metrik kas yang terpisah. Booking-value ROAS, cash ROAS, dan ROAS yang ditampilkan Meta tidak boleh diberi label yang sama.
7. Booking lama tanpa timestamp asli tetap boleh berada dalam laporan operasional. Jangan mengisi waktu palsu untuk meloloskan CAPI.
8. `cancelled`/`refunded`, DP nol, total nol, jumlah dibayar melebihi total, consent tidak valid, identitas kontak tidak valid, atau data harga tak konsisten tidak boleh terkirim. Refund setelah event diterima tidak otomatis menghapusnya dari Meta; perlu jejak koreksi internal.
9. Satu booking grup dengan satu nomor PIC tetap menghasilkan satu Purchase; `pax` bukan jumlah event.
10. Persetujuan pemasaran yang tercatat harus diuji terhadap kebutuhan akun dan kebijakan terbaru sebelum pengiriman nyata. Checkbox saja belum membuktikan semua dasar pemrosesan data.

## 3. Fakta sistem dan batas integrasi yang sudah diketahui

- Stack: Next.js 14 App Router, React, TypeScript, Zod, Supabase Auth/PostgreSQL. UI CS menambah dan memperbarui `closings`; owner mengelola dashboard. Migrasi database ada di `supabase/migrations/` dan CI menjalankan tests SQL.
- WhatsApp CS saat pengguna menjawab: **WhatsApp Business biasa di HP/Web**. Belum ada bukti Cloud API, webhook pesan masuk, WABA yang terhubung, `ctwa_clid`, atau provider resmi yang menyerahkan referral.
- Data lead harian pada dashboard bersifat agregat. Pilihan sumber/campaign manual dan nomor telepon bukan bukti identitas klik CTWA.
- Sync Meta yang sudah ada menarik statistik spend/impressions/clicks/conversations. Export Meta LTV/Gass adalah export data; keduanya bukan pengiriman Purchase CAPI.
- Fase 1 yang sudah dikode memakai `action_source=chat` dan identitas pelanggan yang dinormalisasi lalu di-hash. Jalur `business_messaging/whatsapp` dengan referral CTWA asli adalah **fase 2 yang belum dibangun**. Jangan hanya mengganti `action_source` dalam payload fase 1 lalu menyebutnya CTWA.
- Rincian endpoint, field wajib, izin aset, batas umur event, dukungan test event, aturan deduplikasi, dan eligibility goal Meta dapat berubah. Hermes perlu memeriksa kontrak terbaru dan aset akun Labbaika sebelum integrasi nyata. Angka tujuh hari di simulator adalah kebijakan sementara aplikasi, **bukan** klaim batas universal Meta atau jendela atribusi campaign.
- Labbaika menjual perjalanan ibadah. Payload yang sekarang tidak mengirim nama paket, itinerary, isi chat, paspor, KTP, atau data kesehatan. Pertahankan minimisasi itu dan cek kategori/pembatasan sumber data Meta yang benar-benar berlaku pada akun.

## 4. Status pekerjaan sampai handoff ini

| Area | Sudah ada di workspace lokal | Masih terbuka |
|---|---|---|
| PRD dan pembagian kerja | PRD, riset produk referensi, task list, handoff Hermes, rencana trial, bukti validasi | Revisi setelah kontrak akun dan data nyata diketahui |
| Form CS | Waktu pembayaran pertama WIB, penyimpanan ISO, ID pengiriman form stabil per draft, status CAPI pada detail booking | UAT dengan sesi CS nyata dan kasus koreksi data |
| Aturan Purchase | Validator status, consent, waktu, kontak, harga/pax, DP/full booking value, event ID stabil | Audit kebutuhan bisnis tambahan dari data nyata |
| Database | Migration `032`: `first_payment_received_at`, `capi_settings`, `capi_events`, RLS, trigger antrean, claim/completion dengan lease | Migration staging/produksi; uji scheduler benar-benar bersamaan di lingkungan target |
| Pengiriman | Sender server, bearer untuk worker, token di server, mode off/dry run/test/live, pemeriksaan ulang sebelum kirim, status hasil | Kontrak Meta API akun, credentials, scheduler, test event Meta nyata |
| Monitoring | Pengaturan/riwayat owner; endpoint riwayat dibatasi role dan brand; CS melihat status booking miliknya | Coverage booking yang belum masuk antrean, reconciliation kasus `held`, metrik atribusi |
| Trial September | CLI offline JSON/CSV dan fixture sintetis | **Data closing September asli belum diberikan/diekspor**; XLSX perlu mapping/konversi |
| CTWA click ID | Rancangan capture dan pencocokan | Seluruh webhook, penyimpanan referral, hubungan klik→chat→booking, adapter messaging |
| Deployment | Tidak ada aktivasi | Hosting aktual, secrets, backup, staging, production pilot, operasi harian |

**Status Git penting:** 37 file perubahan CAPI berada dalam Git index branch lokal, tetapi `HEAD` masih baseline `048df937`; belum ada commit CAPI, push, atau PR. Jika Claude Code hanya membuka clone GitHub, pekerjaan itu **tidak ada di sana**. Gunakan workspace lokal di atas, atau gunakan `labbaika-capi.patch` dari ZIP pada checkout terisolasi yang berada di baseline. Sebelum patch: `git apply --check /path/labbaika-capi.patch`. Jangan menerapkan patch lagi pada workspace lokal yang sudah berisi perubahan yang sama. Jangan menjadikan checkout lama `/Volumes/Daily Project/Performance report Labbaika` sebagai sumber kebenaran tanpa membandingkan commit dan statusnya.

**Bukti pemeriksaan yang telah dijalankan pada 7 Oktober:** 145 tests aplikasi di 25 files lulus; 21 files SQL tests lulus pada database PostgreSQL disposable; typecheck lulus; lint 0 error dan 1 warning lama pada font; production build lulus. Rollback/reapply migrasi 032 lulus di database disposable. CLI sintetis menghasilkan booking value Rp60 juta vs DP Rp10 juta. Ini bukti lokal tanggal tersebut; **belum** ada CI untuk perubahan, UAT dengan akun, pengiriman Meta, atau uji dua proses scheduler sungguhan. Jalankan ulang checks setelah perubahan baru, tanpa menganggap hasil lama sebagai hasil 4 November.

## 5. Peta implementasi yang perlu dibaca Claude Code

| Tujuan | File utama |
|---|---|
| Keputusan dan ruang lingkup | `docs/PRD-LABBAIKA-CAPI.md` |
| Status per task | `docs/CAPI-TASKS.md` |
| Konteks agen | `docs/CAPI-CONTEXT.md` |
| Persiapan akun | `docs/hermes-capi-handoff.md`, `docs/HERMES-START.md` |
| Trial September | `docs/capi-trial-plan.md` |
| Detail uji lama | `docs/VALIDATION-CAPI.md` |
| Eligibility, hashing, event ID, full value | `lib/capi/index.ts` |
| Simulator offline | `lib/capi/trial.ts`, `scripts/capi-trial.ts` |
| Sender HTTP Meta | `lib/meta-capi/delivery.ts` |
| Antrean/RLS/RPC | `supabase/migrations/032_capi_outbox.sql` |
| Worker | `app/api/capi/worker/route.ts` |
| Pengaturan/riwayat API | `app/api/capi/settings/route.ts`, `app/api/capi/events/route.ts` |
| Form dan riwayat CS | `app/cs/closing/page.tsx`, `app/cs/closing/riwayat/[id]/page.tsx` |
| Monitoring owner | `app/owner/capi/page.tsx` |
| Pengujian | `lib/capi/index.test.ts`, `lib/meta-capi/delivery.test.ts`, `app/api/capi/worker/route.test.ts`, `tests/sql/032_capi_outbox.sql` |

Alur fase 1 yang sudah ditulis: CS menyimpan booking dan pembayaran pertama → trigger SQL memutuskan apakah satu baris antrean dibuat pada transaksi database yang sama → worker terautentikasi mengambil paling banyak tiga event per run dengan lease lima menit → membaca ulang booking, consent, nilai dan pengaturan → menyusun Purchase → mengirim satu request → mencatat `accepted`, `failed` atau `held`. Timeout jaringan, respons yang tidak pasti, serta lease kedaluwarsa masuk `held` untuk rekonsiliasi, bukan retry otomatis. Hanya rate-limit rejection yang jelas dijadwalkan retry terbatas. Tombol resend manual belum ada.

Identitas event produksi: `labbaika:booking:<closing_uuid>:purchase:v1`. Test memakai prefiks `test:integration:`. Nilai dan waktu tersimpan dalam outbox; payload PII mentah tidak disimpan di outbox. Pengiriman test/dry-run tidak dipromosikan otomatis ke live ketika mode diubah. Antrean dibuat hanya untuk booking baru dan pembayaran pertama setelah waktu aktivasi. Arsip September tidak otomatis terdaftar.

## 6. Syarat produk dan keamanan yang harus dipertahankan

### A. Data closing dan consent

- `first_payment_received_at` boleh kosong pada data lama. Jika diisi, timestamp harus valid, bukan masa depan, tidak mendahului `lead_date` dalam WIB; pembayaran harus positif. UI tidak boleh mengubah waktu yang sudah ada hanya karena input `datetime-local` membulatkan detik.
- Status "terverifikasi" pada fase 1 berarti CS memasukkan pembayaran yang telah dikonfirmasi dalam proses bisnis. Kode saat ini **belum** memeriksa rekening, mutasi bank, atau payment gateway secara otomatis. Bila sumber verifikasi finansial dibutuhkan, definisikan bukti dan integrasinya sebagai pekerjaan terpisah sebelum mengklaim validasi pembayaran otomatis.
- Telepon pelanggan dinormalisasi ke nomor seluler Indonesia, di-hash SHA-256 untuk `user_data.ph`; email valid bila tersedia, dinormalisasi tanpa menghapus tanda `+`/`_`/`-`, lalu di-hash untuk `user_data.em`. Identitas perangkat CS, cookie, IP, dan user-agent CS tidak dipakai sebagai identitas pembeli.
- `pdp_consent` dan waktu pencatatannya tidak boleh diset otomatis agar suatu transaksi lolos. Waktu consent setelah pembayaran dapat sah untuk pengiriman berikutnya bila izin valid sebelum kirim, tetapi jangan mengklaim izin berlaku mundur.
- Perubahan nilai, waktu pembayaran, program, harga/pax, email, nomor, atau waktu consent ketika event belum terkirim menahan antrean untuk review. Accepted event tetap dalam sejarah; pembatalan lokal bukan pembatalan penerimaan Meta.

### B. Akses dan batas tenant

- Owner/advertiser aktif dapat melihat/mengubah `capi_settings` serta membaca event brand sendiri. CS aktif hanya boleh melihat event closing miliknya. HRD tidak diberi akses pengaturan CAPI meskipun helper role lama menganggap HRD mirip owner untuk fitur lain.
- CS membaca/memperbarui closing melalui `v_closings_cs`, bukan tabel dasar; view sengaja tidak mengekspos kolom biaya atau `updated_by`. API PATCH CS jangan kembali mengirim `updated_by` ke view.
- Worker memakai service-role Supabase di server saja, brand/dataset yang dipin oleh environment, bearer secret terpisah minimal 32 karakter, dan RPC lease token. Konfigurasi public Supabase yang sudah dipin dalam repo harus dicocokkan dengan lingkungan sebelum memasang service key.
- Jangan menaruh token, full click ID, nomor/email pelanggan, hash pelanggan, atau isi chat dalam log, respons UI, screenshot handoff, Git, atau file Markdown ini.

### C. Status dan pembuktian

- `off`: tidak membuat pengiriman. `dry_run`: mencatat antrean simulasi tanpa outbound. `test`: outbound test hanya jika route, dataset, test code dan secrets siap. `live`: outbound produksi hanya jika route diverifikasi, izin live server aktif, mode DB live, dan dataset cocok.
- `accepted` berarti respons Meta untuk event tersebut memenuhi pemeriksaan penerimaan teknis. Events Manager/Test Events membantu menguji pipeline, namun belum membuktikan event teratribusi ke campaign, dipakai oleh ad set sebagai optimization goal, atau membuat iklan lebih murah.
- `held`/`completion_unknown` perlu prosedur rekonsiliasi. Jangan mengirim ulang hasil ambigu sebelum mengetahui apakah Meta sudah menerima event; exactly-once melintasi jaringan belum dapat dijamin oleh database saja.
- Pisahkan status booking, nilai booking, uang diterima, nilai event diterima, dan nilai yang teratribusi pada label dashboard serta laporan.

## 7. Cara memperoleh identitas klik CTWA — pekerjaan yang masih terbuka

1. Hermes memeriksa hubungan Business Portfolio, ad account, Page, WABA, nomor bisnis penerima iklan, Meta app, dan dataset. Cek kelayakan **WhatsApp Business app coexistence** untuk nomor yang sekarang dipakai CS. Bila tidak tersedia, rancang provider/inbox atau nomor terpisah beserta dampak operasional, biaya, dan pemulihan.
2. Setelah jalur resmi tersedia, subscription webhook untuk incoming messages dipasang pada nomor yang tepat. Challenge dan signature harus divalidasi. Uji pesan nyata dari iklan CTWA, bukan hanya chat organik.
3. Jika payload aktual berisi referral dengan `ctwa_clid`, simpan ID asli beserta provenance, business recipient, ID pesan, waktu, identitas kontak yang terlindungi dan ad/source ID bila tersedia. Deduplikasi berdasarkan message ID. Jangan menciptakan click ID, menyalin `fbclid`, atau menyamakan campaign pilihan CS dengan identitas klik.
4. Hubungkan conversation ke booking memakai brand, nomor bisnis tujuan, kontak ternormalisasi, waktu interaksi dan konfirmasi CS saat ambigu. Satu kontak dapat menghubungi beberapa kali atau membuat beberapa booking. Jangan memilih referral terakhir secara otomatis tanpa aturan/audit.
5. Setelah Hermes memverifikasi schema Business Messaging untuk versi/akun yang digunakan, buat adapter payload terpisah (`business_messaging`/WhatsApp) dan tests end-to-end. Jika referral tidak ada, statusnya missing. Jangan memalsukan hubungan untuk data September yang tidak pernah menangkap ID ini.

Dokumentasi Meta tentang Business Messaging/Coexistence dan izin harus dibuka ulang saat implementasi. Handoff lama mencatat beberapa halaman Meta tidak bisa diakses saat riset Oktober; contoh SDK dan sample lama hanya menunjukkan konsep, bukan kontrak API mutakhir.

## 8. Trial closing September

Pengguna menyebut data closing bulan September; Hermes dapat mengambil export atau pengguna dapat memberikan Excel. **Sampai 4 November belum ada file asli dalam workspace CAPI**. Rencana sebelumnya mengasumsikan September 2026 dari konteks waktu; pastikan tahun/periode saat export diterima.

Untuk trial, tetapkan cohort secara eksplisit: berdasarkan `closing_date` bulan September atau berdasarkan pembayaran pertama September. Jangan mencampur keduanya. Export satu baris per booking kanonik, bukan per cicilan/jamaah. Kolom minimum: `id`, `brand_id`, `program_id`, `whatsapp_e164`, `email` bila ada, `pdp_consent`, `pdp_consent_at`, `payment_status`, `paid_amount`, `price_at_transaction`, `pax`, `total_value`, `is_price_override`, `price_note`, `lead_date`, `closing_date`, `first_payment_received_at`; parser juga menerima `first_name` dan dapat diisi string kosong untuk minimisasi. Mapping lengkap ada pada `docs/capi-trial-plan.md`.

Excel tidak langsung dibaca aplikasi. Konversi terkontrol ke JSON array atau CSV UTF-8; nomor harus tetap teks, rupiah integer tanpa pemisah ribuan, boolean `true/false`, tanggal `YYYY-MM-DD`, timestamp ISO 8601 dengan zona waktu. Kolom waktu yang hanya memiliki tanggal tanpa jam tetap dianggap tidak lengkap. Letakkan file asli di lokasi privat di luar Git, catat mapping dan rekonsiliasi jumlah/nilai sebelum dan sesudah konversi.

CLI: `npm run capi:trial -- /path/privat/closing-september.json` menghasilkan agregat kelayakan, alasan penolakan, jumlah duplikat, total booking value serta paid amount untuk baris layak. Ia tidak memanggil Meta dan tidak mengubah database. `--now` dipakai hanya untuk simulasi bertanggal yang dijelaskan secara eksplisit; worker produksi memakai waktu aktual. Karena saat ini November, seluruh transaksi September mungkin terlalu tua untuk kebijakan sementara tujuh hari, tetapi tentukan hasil per baris berdasarkan timestamp asli dan kontrak route yang diverifikasi. Jangan menggeser `event_time` menjadi hari ini.

## 9. Urutan kerja konkret untuk Claude Code

Gunakan daftar ini sebagai pekerjaan eksekusi, bukan sekadar rencana. Setiap item selesai ketika bukti penerimaannya ada. Jika satu item memerlukan akses akun yang belum tersedia, kerjakan bagian independennya dan tandai dependensi secara tepat.

| Prioritas | Task | Hasil dan kriteria selesai |
|---|---|---|
| P0.1 | Pastikan checkout dan perubahan lokal | `git status`, HEAD, remote, serta 37 file perubahan diperiksa. Jika clone baru, terapkan patch pada baseline setelah `git apply --check`. Jangan menimpa kerja lokal lain. |
| P0.2 | Audit implementasi fase 1 terhadap PRD | Periksa terutama trigger SQL, RLS CS/brand, time/consent/value, mode transition, lease, timeout, hasil ambigu, pencegahan double submit dan data PII. Catat temuan yang benar-benar actionable; perbaiki bug yang ditemukan. |
| P0.3 | Jalankan validasi ulang | `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, lalu rangkaian SQL pada PostgreSQL disposable sesuai CI. Laporkan angka aktual dari run baru. Jangan jalankan bootstrap test pada Supabase produksi. |
| P1.1 | Buat coverage monitor | Tampilkan agregat booking baru yang tidak masuk antrean dengan alasan yang aman dan dapat ditindaklanjuti: waktu DP kosong, consent, nominal, kontak, status, konfigurasi. Role/brand isolation dan uji kasusnya wajib. Jangan otomatis mendaftarkan transaksi lama. |
| P1.2 | Buat prosedur reconciliation `held` | Desain admin review dengan bukti penerimaan Meta yang tersedia, audit keputusan, dan guard agar satu booking tidak terkirim dua kali. Jangan menambah tombol “kirim ulang” tanpa kontrak dedup/rekonsiliasi. |
| P1.3 | Perkuat audit setting dan worker run | Catat perubahan mode/dataset dengan aktor, serta ringkasan run worker tanpa token/PII. Status yang tidak pasti harus terlihat dalam monitoring. |
| P1.4 | UAT staging dengan Hermes | Setelah aset test tersedia: migration032, login owner/advertiser/CS/HRD, form dan cicilan, isolasi brand, dua worker bersamaan, perubahan consent/refund, kegagalan jaringan, dan rollback operasional. |
| P2.1 | Integrasi referral resmi | Kerjakan schema conversation/referral, webhook terverifikasi, dedup message, pencocokan booking, dan UI pemilihan saat ambigu **setelah** jalur WhatsApp serta payload nyata terkonfirmasi. |
| P2.2 | Adapter Business Messaging | Bangun kontrak terpisah sesuai dokumentasi versi aktual; required fields, izin, umur event, test mode, dedup dan batas kategori dari Hermes. Missing referral ditahan. |
| P3.1 | Metrik atribusi dan evaluasi | Baca action type/values Ads Insights yang benar dari akun, tampilkan angka agregat terpisah, cek goal ad set, lalu siapkan eksperimen performa yang membedakan booking, kas, refund dan biaya iklan. |

P1.1–P1.3 dapat diproduksi dan dites tanpa token Meta. P2 menunggu keputusan jalur WhatsApp resmi. P3 memerlukan bukti akun dan periode pilot. Jika prioritas berubah, pertahankan aturan full booking value dan jangan menandai dependent task selesai tanpa bukti.

## 10. Tugas Hermes/API yang perlu diminta sebagai input ke Claude Code

Hermes mengisi matriks berikut dari akun dan dokumentasi terbaru, tanpa menempel secret dalam chat/PR:

| Pertanyaan | Bukti yang diserahkan |
|---|---|
| Deployment aktual dan auto-deploy | Host, branch yang dipasang, mekanisme scheduler, target database, backup dan rollback |
| Hubungan aset | Business, ad account, Page, app, WABA, nomor, dataset/pixel, pemilik dan izin masing-masing |
| Route generic chat saat ini | Endpoint/versi/required fields, dukungan `test_event_code`, batas umur, dedup dan kategori penggunaan |
| Route CTWA Business Messaging | Schema referral asli, field wajib, scope token, business identifier, versi API dan eligibility akun |
| WhatsApp app coexistence/provider | Bukti eligible/tidak, dampak pada HP/Web, biaya/inbox, nomor uji, rencana pemulihan |
| Pengukuran iklan | Objective, conversion location, destination, performance goal, attribution setting, timezone dan metric purchase aktual |
| September | Export asli, tahun, cohort, timezone, mapping Excel→JSON/CSV, jumlah dan nilai yang direkonsiliasi |

Rahasia server yang perlu dikelola Hermes tercantum di `.env.example`: `META_CAPI_BRAND_ID`, `META_CAPI_DATASET_ID`, `META_CAPI_ACCESS_TOKEN`, `META_CAPI_API_VERSION`, `META_CAPI_MAX_EVENT_AGE_SECONDS`, `META_CAPI_ROUTE_VERIFIED`, `META_CAPI_ALLOW_LIVE`, `META_CAPI_TEST_EVENT_CODE`, `CAPI_WORKER_SECRET`; `SUPABASE_SERVICE_ROLE_KEY` sudah merupakan kebutuhan server yang terpisah. Nilai `META_CAPI_ROUTE_VERIFIED` dan live switch tidak boleh diaktifkan hanya karena unit test lulus. Scheduler fase 1 dapat ditargetkan tiap lima menit setelah test account sesuai kemampuan host; timeout dan batas batch perlu diuji terhadap host nyata.

## 11. Kriteria penerimaan dan pelaporan hasil

**Fase 1 kode/staging diterima bila** form menyimpan booking normal tanpa menunggu Meta; DP Rp10 juta pada booking Rp60 juta menghasilkan tepat satu kandidat Purchase Rp60 juta; cicilan tidak menambah event; tanpa consent/waktu asli/nominal valid tidak terkirim; off/dry-run menghasilkan nol request Meta; test mode memakai aset test; role CS/HRD/brand terisolasi; timeout/lease ambigu masuk review; test, SQL, build dan UAT staging lulus.

**Pilot Meta diterima secara teknis bila** satu transaksi uji baru dengan waktu asli terlihat sebagai event server pada aset/route yang benar, nilai dan currency benar, respons Meta serta diagnostik dicatat secara tersamarkan. HTTP 200 tunggal atau badge “Processed” belum cukup untuk klaim atribusi iklan.

**Atribusi CTWA baru dapat dinilai bila** alur klik iklan nyata → webhook referral asli → conversation → booking → DP → Purchase dapat ditelusuri secara internal, dan Ads Manager menampilkan metrik terkait pada jendela/waktu/goal yang sepadan. Ketersediaan outcome API atau goal purchase-through-messaging pada ad set harus diverifikasi. Perubahan CPA/ROAS dinilai melalui baseline dan perbandingan yang memperhitungkan program, spend, audience, creative, pekerjaan CS, dan refund; tidak ada jaminan performa naik.

Setiap laporan Claude Code harus menyebut: file yang diubah, keputusan yang dijaga, pemeriksaan yang benar-benar dijalankan, angka hasil, dependensi Hermes, serta apa yang masih belum diuji. Perbarui `docs/CAPI-TASKS.md`, `docs/VALIDATION-CAPI.md`, dan PRD bila kontrak berubah. Pisahkan “selesai lokal”, “selesai staging”, “accepted Meta”, “attributed”, dan “dipakai optimasi” dalam status.

## 12. Batas rilis dan pemulihan

Mulai dari branch terisolasi. Jangan push `main` sebagai percobaan karena catatan lama menyebut mekanisme auto-pull/deploy; verifikasi deployment aktual lebih dulu. Review migrasi 032 serta backup sebelum database staging/produksi. Pengaturan awal adalah `off`; perpindahan mode menahan antrean lama, bukan mempromosikan event test atau data historis ke live.

Untuk pemulihan operasional: matikan mode dan live switch server, hentikan scheduler, pertahankan booking dan audit event diterima. Rollback destruktif SQL di `supabase/migrations/rollback/032_capi_outbox_down.sql` hanya untuk database disposable atau setelah backup serta review dampak; rollback aplikasi lokal tidak mencabut event yang telah diterima Meta.

## 13. Referensi kerja

- [PRD awal Labbaika](PRD-LABBAIKA-CAPI.md)
- [Daftar tugas CAPI](CAPI-TASKS.md)
- [Context handoff](CAPI-CONTEXT.md)
- [Handoff Hermes dan sumber Meta](hermes-capi-handoff.md)
- [Rencana trial September](capi-trial-plan.md)
- [Bukti validasi 7 Oktober](VALIDATION-CAPI.md)
- [Analisis produk referensi](TRIGGER-CAPI-COMPARISON.md)
- [Meta sample CAPI/CTWA](https://github.com/fbsamples/lead-ads-webhook-sample/blob/main/postman/FB%20Conversions%20API%20%28Part%201%20-%20online%29.postman_collection.json) — acuan konsep lama; periksa ulang API mutakhir.
- [Meta SDK AdSet](https://github.com/facebook/facebook-nodejs-business-sdk/blob/main/src/objects/ad-set.js) — daftar field/enum bukan bukti eligibility akun.
- [Dokumentasi Business Messaging Meta](https://developers.facebook.com/docs/marketing-api/conversions-api/business-messaging/) — verifikasi ulang saat integrasi; beberapa halaman Meta tidak dapat diakses pada riset awal.
