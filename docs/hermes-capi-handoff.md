# Handoff Hermes — Labbaika Booking Purchase CAPI

Status: rancangan implementasi dan kontrak integrasi; bukan bukti aktivasi produksi. Diperbarui 7 Oktober 2026 (Asia/Jakarta). Dokumen ini tidak memberi instruksi untuk mengirim data September otomatis.

## 1. Project dan keputusan bisnis

- Repository: https://github.com/projectclientzen/performance-marketing-labbaika
- Workspace kerja: `/Volumes/Daily Project/AI PROJECT ZEN/labbaika-capi`
- Branch kerja: `codex/labbaika-capi-booking-value`.
- Stack hasil inspeksi: Next.js 14, TypeScript, Supabase PostgreSQL/Auth; catatan project menyebut Vercel dan VPS pada periode berbeda. Verifikasi deployment aktual serta mekanisme auto-pull sebelum membuat scheduler.
- Artefak terkait: PRD utama di direktori `docs`; rencana trial: [capi-trial-plan.md](./capi-trial-plan.md).
- WhatsApp saat ini: WhatsApp Business biasa pada HP/Web, menurut pengguna. Akses Cloud API/webhook belum terkonfirmasi.
- Keputusan pengguna: DP pertama yang valid memicu **satu Purchase per booking**. `value` adalah total nilai produk/booking, **bukan DP**.
- Contoh: harga program pada transaksi Rp30.000.000/pax × 2 pax = `value: 60000000`, `currency: IDR`; DP Rp10.000.000 memicu satu event itu. Pelunasan berikutnya tidak membuat Purchase kedua.
- Simpan harga/pax/override pada booking, dan snapshot nilai serta waktu pada outbox saat booking memenuhi syarat. Jangan membaca ulang harga master ketika retry. `total_value` harus dapat direkonsiliasi ke snapshot; diskon/override wajib mempunyai alasan. Audit perubahan closing yang ada merekam aktor melalui `auth.uid()`; audit settings CAPI dan detail run worker menjadi task O03.
- `event_time` adalah waktu DP pertama diterima dan terverifikasi, bukan tanggal keberangkatan, waktu CS menekan tombol, atau waktu pengiriman ulang.
- Ini sinyal **booking value**, bukan bukti cash revenue telah diterima. Label metrik dashboard harus membedakannya.

## 2. Batas pekerjaan dan pembagian

Codex membangun kualitas data, eligibility, snapshot, outbox/antrean, adaptor payload, audit, status UI, dry-run dan pengujian. Hermes menangani akses akun, verifikasi kontrak API mutakhir, aset Meta/WhatsApp, secret deployment, scheduler, serta pengujian integrasi akun.

Pekerjaan boleh berjalan dengan mode off/dry-run tanpa akses produksi. Jangan mengaktifkan live, menerapkan migrasi produksi, mengubah campaign, membeli BSP, atau memindahkan nomor WhatsApp hanya karena dokumen ini menyebut langkahnya. Tahap live dilakukan sebagai handoff operasional setelah perubahan dan konfigurasi telah diperiksa pemilik.

## 3. Cara memperoleh identitas klik CTWA

Meta memperlihatkan alur klik iklan → pesan masuk WhatsApp API → `referral.ctwa_clid` → outcome yang dikirim melalui CAPI. Contoh primer memakai `action_source: business_messaging`, `messaging_channel: whatsapp` dan `ctwa_clid` pada `user_data`. Ini identitas dari platform, bukan nomor telepon atau nama campaign. [S1]

### Jalur A — onboarding resmi dengan coexistence bila tersedia

Tujuan: CS tetap bekerja di Business app sementara backend menerima data yang didukung API. Hermes harus memeriksa kelayakan nomor/akun/region dan onboarding melalui penyedia/Tech Provider yang memenuhi ketentuan Meta. Jangan menganggap setiap nomor otomatis eligible. Referensi onboarding resmi ada di [S4], tetapi halaman tersebut tidak berhasil diambil dalam sesi riset ini; detail eligibility dan batasannya wajib diverifikasi langsung sebelum keputusan.

Tugas kecil:

1. Inventaris nomor CS yang menjadi tujuan iklan dan pemilik nomor tersebut; jangan mempublikasikan nomor lengkap pada laporan.
2. Identifikasi WABA, phone number ID, Meta app, Page, dan business portfolio terkait.
3. Tampilkan opsi coexistence yang benar-benar tersedia, pengaruh pada HP/Web, biaya, izin, batas perangkat/fitur, serta rencana pemulihan. Jangan menjanjikan kesinambungan aplikasi tanpa tes.
4. Jika eligible, selesaikan onboarding resmi pada nomor percobaan atau ruang lingkup yang disetujui.
5. Pasang endpoint HTTPS dengan verifikasi challenge dan autentikasi signature webhook. Subscription harus mencakup incoming `messages` pada akun/nomor yang benar.
6. Uji sebuah percakapan baru dari iklan CTWA yang benar. Tampilkan bukti payload tersamarkan dengan `messages[].referral.ctwa_clid` bila tersedia pada bentuk payload aktual. Bukan hanya tes chat organik.
7. Kirim struktur minimum hasil parsing ke Labbaika: nomor bisnis tujuan, identitas pesan, identitas kontak terlindungi, waktu diterima, ID klik asli, sumber/ad ID jika diberikan. Simpan riwayat referral, bukan menimpa satu kolom global setiap ada pesan baru.
8. Hubungkan lead ke booking dengan nomor kontak ternormalisasi + nomor bisnis/tenant + waktu percakapan. Jika satu nomor memiliki beberapa lead atau klik, tandai ambigu; CS/admin memilih percakapan yang tepat dengan jejak audit. Jangan selalu mengambil klik paling akhir tanpa aturan.
9. Pastikan replay webhook idempotent dan urutan pesan terlambat tidak mengganti link booking yang telah dibekukan.
10. Periksa hak akses dan retensi. Isi percakapan lengkap tidak diperlukan untuk Purchase.

### Jalur B — Cloud API/BSP/CRM tanpa coexistence

Jika A tidak tersedia, Hermes mengusulkan migrasi resmi atau nomor terpisah dengan inbox yang sesuai. Sebelum migrasi: jelaskan perubahan kerja CS, biaya, kemampuan inbox, backup, routing iklan, dan pemulihan. Pilih penyedia yang benar-benar meneruskan referral/`ctwa_clid` atau menawarkan outcome API terdokumentasi. Dukungan “WhatsApp integration” saja tidak cukup.

### Jalur C — tetap Business app saat ini

Dashboard tetap dapat mencatat booking, menjalankan dry-run, dan menyiapkan kontrak pengiriman non-CTWA yang benar-benar didukung akun. Pengiriman generic `chat` adalah jalur berbeda yang perlu diverifikasi; bukan pengganti yang dianggap otomatis dapat mengoptimasi CTWA.

Jangan membuat `ctwa_clid`, menyalin `fbclid` menjadi `ctwa_clid`, mengambil cookie/IP/perangkat CS sebagai identitas pembeli, atau menganggap campaign pilihan manual sebagai bukti klik. Coexistence/history sync di masa depan tidak menjamin referral September dapat dipulihkan. Jika ID lama tidak tersedia dari sumber asli, laporkan **missing**, bukan direkonstruksi.

## 4. Kontrak API yang harus dibuktikan Hermes

Isi matriks ini sebelum live; simpan link dokumentasi, waktu pemeriksaan, dan bukti account-specific tanpa secret.

| Item | Keputusan/bukti yang diminta |
|---|---|
| Jalur | `business_messaging/whatsapp` untuk CTWA asli; atau jalur lain yang benar secara fakta dan didukung akun. Jangan label `website` hanya karena CS memakai web dashboard. |
| Endpoint | Endpoint dataset events yang benar untuk jalur terpilih; contoh Meta menggunakan `POST /v{version}/{dataset_id}/events`. [S1] |
| Versi API | Versi aktif yang didukung app dan endpoint saat pemasangan; pin eksplisit dan catat tanggal review. Jangan menyalin versi contoh lama. |
| Aset | ID portfolio, app, WABA, phone number, Page, dataset/pixel, ad account; hubungan/izin tiap aset. ID aset bukan token tetapi tetap batasi penyebaran. |
| Field wajib | Schema `user_data` aktual: `ctwa_clid`, WABA/Page ID dan field lain sesuai versi. Contoh lama bukan kontrak mutakhir. Jangan kirim kombinasi dugaan. |
| Scope token | Scope aktual dan asset assignment minimal untuk CAPI messaging; verifikasi termasuk kebutuhan `whatsapp_business_management` / `whatsapp_business_manage_events` bila diminta dokumentasi/jalur. Izin kirim pesan bukan otomatis izin kirim outcome. |
| Test mode | Apakah route mendukung `test_event_code`, dataset test, dan bentuk bukti di Events Manager. Jika tidak, tahan test outbound sampai prosedur terpisah ditentukan. |
| Umur event | Batas penerimaan `event_time` untuk route/version yang dipilih. Simpan sebagai aturan konfigurasi yang diverifikasi, bukan angka global asal. |
| Deduplikasi | Apakah route mendukung `event_id`, lama jendela dan cakupannya. Jangan memindahkan jaminan dedup web ke messaging. |
| Waktu/atribusi | Timezone akun, attribution setting aktual ad set, jenis action reporting dan reporting-time basis. |
| Kebijakan data | Diagnostik dataset/data-source category dan batas event/parameter yang benar-benar muncul pada akun. |

SDK resmi membedakan goal `CONVERSATIONS` dan `MESSAGING_PURCHASE_CONVERSION`, serta memiliki `attribution_spec`, `promoted_object` dan `destination_type`. Keberadaan enum di SDK **tidak membuktikan** fitur itu tersedia untuk akun Labbaika. [S2]

## 5. Secret dan scheduler

Nama konfigurasi fase1 sudah tercantum di `.env.example`. Konfigurasi webhook masih kebutuhan fase2. Semua nilai secret belum diisi. Worker saat ini mengirim generic `chat`; memilih Business Messaging membutuhkan adapter W05, bukan hanya mengganti variabel lingkungan.

| Konfigurasi | Jenis/aturan |
|---|---|
| Dataset ID, Graph API version, jalur event | Server config, tervalidasi dan berbeda antara test/live |
| CAPI access token | Secret server; jangan memakai `NEXT_PUBLIC_`; jangan commit atau tampilkan di dashboard/chat |
| Meta app secret dan webhook verify token | Secret jika webhook diaktifkan; signature diverifikasi sebelum memproses |
| Test event code | Server test config; bukan pengganti autentikasi |
| Scheduler credential | Secret terpisah untuk endpoint worker; bukan session CS |
| Supabase service role | Server only; hanya worker/RPC yang memerlukannya |
| Live switch dan send cap | Default off/dry-run; batas batch dan maksimum event per run eksplisit |

Rancangan scheduler: jalankan worker setiap 5 menit sebagai target awal, disesuaikan kemampuan hosting. Worker mengambil antrean secara atomik dengan lease/lock, batch kecil, timeout, dan pencatatan run. Dua run bersamaan tidak boleh mengirim booking yang sama. Tidak ada akses worker anonim.

Pada kegagalan sebelum request dikirim, retry dapat dijadwalkan. Pada respons error pasti, klasifikasikan transient/permanent berdasarkan kontrak endpoint. Pada timeout/koneksi putus **setelah kemungkinan request diterima**, tandai `held` dengan kode `delivery_unknown` / `lease_expired_delivery_unknown` bila idempotensi Meta route belum dibuktikan. Jangan retry buta dan menjanjikan exactly-once lintas jaringan. Event yang sudah diterima tidak dikirim lagi oleh tombol coba ulang.

Rollback: matikan pengiriman dan scheduler, pertahankan closing serta audit. Mematikan aplikasi tidak menarik kembali event yang sudah diterima Meta.

## 6. Minimal payload dan data yang tidak dikirim

Payload final dibangun dari allowlist: nama event, waktu sebenarnya, identitas event jika didukung, sumber aksi yang benar, matching fields yang valid, mata uang dan booking value. Simpan program/pax/harga lengkap untuk rekonsiliasi internal; atribut produk outbound hanya ditambahkan jika diperlukan serta diizinkan.

Labbaika menjual perjalanan ibadah, sehingga detail program atau isi catatan dapat mengungkap praktik agama; jangan otomatis mengirim nama paket religius, catatan CS, isi chat, paspor, KTP, kesehatan jamaah, atau data penumpang lain. Ini alasan konkret memeriksa kategori sumber data dan minimisasi, bukan klaim akun Labbaika telah dibatasi. Meta menyebut keyakinan agama sebagai jenis informasi sensitif pada kebijakan privasinya dan mensyaratkan partner memiliki hak berbagi data. [S6] Hermes harus memeriksa ketentuan Business Tools mutakhir [S7] dan pembatasan aktual; hashing atau mengganti nama event tidak membolehkan pengiriman yang dilarang. Bila sumber/event dibatasi, hentikan jalur terlarang dan laporkan opsi yang diizinkan, jangan menyamarkannya sebagai sumber lain.

`pdp_consent` pada project membantu bukti internal, tetapi label checkbox saja bukan verifikasi seluruh izin/pemberitahuan yang dibutuhkan. Payload hash dan `ctwa_clid` tetap dibatasi aksesnya dan tidak muncul di log publik.

## 7. Cara membuktikan accepted → attributed → optimization

### A. Diterima secara teknis

Kumpulkan request tersamarkan, waktu kirim, version, route, jumlah event, kode respons, `events_received` jika tersedia, pesan diagnostik, dan trace ID. Cocokkan satu event internal ke Events Manager sebagai event server/sumber yang benar. HTTP 200 saja tidak cukup. Test Events hanya bukti pipeline pengujian, bukan hasil penjualan iklan.

### B. Teratribusi ke iklan

Gunakan pembelian nyata baru yang memiliki referral asli. Cocokkan urutan klik → chat → DP dalam audit internal, lalu bandingkan hasil agregat Ads Manager setelah waktu pemrosesan yang dinyatakan Meta. Jangan mengharapkan Ads Manager mengekspos identitas pembeli atau memberikan receipt atribusi per event.

Hermes membaca/export setting campaign/ad set: objective, conversion location/destination, performance goal, dataset/promoted object bila relevan, attribution setting, status/diagnostik. Di API gunakan field yang didukung versi, misalnya `optimization_goal`, `destination_type`, `promoted_object`, `attribution_spec`; snapshot UI diperlukan jika detail tidak tersedia via API. [S2]

Bandingkan jendela tanggal, timezone, attribution basis dan definisi metric yang sama. Kesenjangan diselidiki berdasarkan missing click ID, konversi di luar attribution window, delay, route/aset salah, consent/data missing, pembatasan, atau duplikasi. Bukti API accepted dan atribusi merupakan laporan terpisah.

### C. Tersedia untuk optimasi dan menghasilkan dampak

Periksa bahwa pilihan purchase-through-messaging benar-benar tersedia serta dipilih pada ad set terkait. Mengirim `value` besar tidak otomatis mengaktifkan value optimization. Jika goal masih conversations, tulis apa adanya. Jangan mengubah campaign/budget tanpa instruksi operasional.

Jika pengguna kemudian menyetujui eksperimen, tetapkan baseline, periode dan batas anggaran sebelumnya; gunakan eksperimen terkontrol yang tersedia atau cohort sebanding. Ukur biaya per booking valid, booking-value ROAS, cash ROAS, refund/cancel rate, capture coverage dan latency. Bandingkan program, pax, spend, creative, audience, serta kerja CS; perubahan biaya sendirian tidak membuktikan dampak kausal CAPI. Jangan menjamin ROAS naik.

## 8. Checklist task Hermes

| ID | Task kecil | Dependensi | Bukti selesai |
|---|---|---|---|
| H01 | Inventaris deployment/aset akun tanpa mengubahnya | Akses owner | Matriks aset dan lingkungan tersamarkan |
| H02 | Verifikasi route, API version, event-age, dedup/test rules | H01 | Matriks kontrak section 4 terisi + sumber/tanggal |
| H03 | Cek category/diagnostics, consent dan payload allowlist | H01–02 | Daftar field diizinkan dan masalah aktual |
| H04 | Cek coexistence/BSP untuk nomor CS | H01 | Opsi eligible, biaya dan dampak CS; belum migrasi |
| H05 | Konfigurasi secret pada lingkungan test | H02–03 | Nama config terisi, tanpa nilai secret |
| H06 | Uji worker/scheduler autentikasi dan lock | Kode siap, H05 | Satu run, replay, concurrent run, failure log tersamarkan |
| H07 | Uji payload sintetis resmi pada route test yang didukung | H02, H05–06 | Bukti test server event atau blocker tepat |
| H08 | Aktifkan webhook test dan uji referral asli | Jalur WA disetujui, H04 | Referral → lead → booking tersambung, signature valid |
| H09 | Baca konfigurasi ad set dan metrik relevan | H01–02 | Snapshot actual settings; availability tidak diasumsikan |
| H10 | Evaluasi kelayakan cohort September | Trial dry-run | Jumlah layak/tidak, umur dan missing time/referral |
| H11 | Persiapkan pilot transaksi baru | H03, H07–09 | Daftar booking eligible + cap + rollback, belum bulk send |
| H12 | Jalankan pilot live sesuai aktivasi yang disetujui | H11 | Accepted/attributed/optimization dilaporkan terpisah |
| H13 | Serahkan runbook dan operasi harian | H12 | Owner operasional, rotasi secret, alert, backlog dan rollback |

## 9. Format hasil untuk diserahkan kembali

- Status per H01–H13: done / blocked / not started, bukti dan next action.
- Tanggal, lingkungan, commit aplikasi dan versi API.
- Ringkasan jumlah booking, event diterima, event gagal, kasus ambigu; angka atribusi pada laporan terpisah.
- Bukti berupa screenshot tersamarkan dan JSON hanya field non-rahasia. Jangan sertakan token, nomor/email lengkap, hash customer, full `ctwa_clid`, isi chat, atau dokumen perjalanan.
- Catat blocker yang benar-benar terjadi; jangan mengarang status akun, field wajib, umur maksimum, atau eligibility.

## 10. Sumber dan keterbatasan riset

Diperiksa 6 Oktober 2026. Semua rujukan di bawah merupakan sumber primer Meta. Instruksi teknis di atas yang bukan kutipan adalah rancangan project, bukan ketentuan Meta.

- **S1 (terbaca):** [Meta fbsamples — CAPI sample](https://github.com/fbsamples/lead-ads-webhook-sample/blob/main/postman/FB%20Conversions%20API%20%28Part%201%20-%20online%29.postman_collection.json). Mengonfirmasi alur referral/CTWA dan contoh endpoint/payload. File mengandung contoh lama; tidak dipakai untuk menetapkan API version atau seluruh required fields mutakhir.
- **S2 (terbaca):** [SDK resmi Meta — AdSet](https://github.com/facebook/facebook-nodejs-business-sdk/blob/main/src/objects/ad-set.js). Mengonfirmasi field konfigurasi dan perbedaan enum goal. Tidak membuktikan eligibility akun.
- **S3 (terbaca):** [WhatsApp Business Platform resmi di Postman — Webhooks](https://www.postman.com/meta/whatsapp-business-platform/folder/lboq68h/webhooks). Rujukan setup webhook dan subscription.
- **S4 (429 saat diakses; verifikasi Hermes):** [Onboarding Business app users](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users).
- **S5 (429 saat diakses; verifikasi Hermes):** [CAPI Business Messaging](https://developers.facebook.com/docs/marketing-api/conversions-api/business-messaging/) dan [Server event parameters](https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/server-event/). Tidak ada klaim angka umur event, jendela dedup, atau dukungan test messaging mutakhir yang telah terverifikasi dari halaman ini.
- **S6 (terbaca):** [Meta regional privacy notice](https://www.facebook.com/privacy/policies/uso/). Digunakan hanya untuk kategori sensitivitas dan hak berbagi, bukan klaim aturan hukum Indonesia atau klasifikasi akun.
- **S7 (login/blocked saat diakses; verifikasi Hermes):** [Meta Business Tools Terms](https://www.facebook.com/legal/technology_terms).
