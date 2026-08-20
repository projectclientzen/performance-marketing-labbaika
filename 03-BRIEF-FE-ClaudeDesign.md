# Brief Frontend: Labbaika Reporting Platform

> **KOREKSI LINGKUP — 20 Agustus 2026. Baca sebelum membangun apa pun dari dokumen ini.**
>
> Seluruh pembahasan **HPP, gross profit, margin, dan break-even berbasis biaya**
> di dokumen ini **sudah dibatalkan** dan **tidak boleh dibangun**. Pemilik produk
> adalah advertiser, bukan bagian keuangan: yang diukur sistem ini adalah
> efektivitas iklan di atas **omset**, bukan margin.
>
> Yang berlaku sekarang: `roi = (omset − spend) / spend`, `roas = omset / spend`,
> `breakeven_cpp = omset / jumlah closing`. Tidak ada `gross_profit`,
> `margin_pct`, `cost_coverage_rate`, tabel `program_costs`, maupun trigger T-7.
> Harga program masuk lingkup; HPP program tidak.
>
> Ditambahkan juga role `advertiser`, dengan akses setara `owner` — satu
> dashboard utama untuk keduanya.
>
> Rinciannya di `10-AUDIT-FE-BE.md` §20 dan §21. Kalau dokumen ini dan berkas itu
> berbeda, **berkas itu yang menang.**


Untuk dikerjakan di **Claude Design**.
Output yang diharapkan: prototipe visual berfungsi dengan data mock, belum tersambung backend.
Sumber kebenaran produk: `02-PRD-v1.1.md`.

---

## 1. Konteks singkat

Travel umroh Labbaika Group punya dua jenis pengguna dengan kebutuhan yang berlawanan:

**CS** memakai aplikasi di HP, sering sambil membalas chat calon jamaah. Dia hanya punya sekitar 90 detik di ujung hari. Kalau formnya berat, dia balik ke spreadsheet. Kecepatan input mengalahkan segalanya.

**Owner/Advertiser** memakai aplikasi untuk memutuskan naik atau turunkan budget iklan. Dia butuh angka yang tidak ambigu, dan butuh tahu angka mana yang belum matang.

Satu aplikasi, dua ritme. Desain harus terasa satu keluarga tapi tidak memaksa CS melihat dashboard analitik, dan tidak memaksa Owner melewati form input.

---

## 2. Arah visual

### Tema: Subuh

Jam kerja CS travel umroh dimulai sebelum matahari terbit dan berakhir larut. Palet mengambil dari langit subuh: biru malam yang belum habis, satu garis kuningan hangat di ufuk. Bukan tema religius yang literal, bukan dashboard SaaS biru-ungu.

### Token warna

```css
--ink-900:  #0E1626;  /* navy hampir hitam, teks utama dan header */
--ink-600:  #3A4A66;  /* teks sekunder */
--ink-400:  #7C8AA3;  /* teks tersier, label */
--paper:    #EFF2F6;  /* background aplikasi, dingin bukan krem */
--card:     #FFFFFF;
--line:     #DCE2EA;

--brass:    #B8862F;  /* aksen tunggal: primary action + angka kunci */
--brass-lo: #F5EBD6;  /* fill lembut brass */

/* warna stage, dipakai konsisten di seluruh aplikasi */
--stage-cold:    #8A94A6;
--stage-consult: #3D7CC9;
--stage-offer:   #B8862F;
--stage-closing: #1F7A5C;

--danger:   #A8332B;
--warn:     #C9761E;
--ok:       #1F7A5C;
```

Aturan: brass hanya muncul di tombol aksi utama dan satu angka paling penting per layar. Kalau brass muncul lebih dari dua kali di satu layar, hapus salah satunya.

### Tipografi

| Peran | Typeface | Catatan |
|---|---|---|
| Display / heading | **Bricolage Grotesque** | berat 600-700, tracking rapat, dipakai hemat |
| Body / UI | **Instrument Sans** | seluruh label, tombol, isi form |
| Angka & tabel | **IBM Plex Mono** | tabular figures, semua rupiah dan metrik |

Semua angka uang dan metrik pakai Plex Mono supaya kolom tabel rata dan angka besar mudah dibandingkan sekilas. Ini juga membedakan "data" dari "narasi" tanpa perlu garis tambahan.

Skala: 32 / 24 / 18 / 15 / 13 / 11. Body 15px di mobile, jangan turun ke 13 untuk isi form.

### Elemen signature: Stage Rail

Satu batang horizontal tersegmen empat, lebar tiap segmen proporsional terhadap jumlah lead di stage itu, warnanya mengikuti token stage. Elemen yang sama muncul di tiga skala:

- **mini** (tinggi 4px) di baris daftar laporan
- **medium** (tinggi 12px, ada angka) sebagai preview langsung di form CS saat mengetik
- **besar** (tinggi 40px, bertingkat) sebagai funnel di dashboard Owner

Efeknya, CS dan Owner membaca bentuk visual yang sama meski konteksnya beda. Ini satu-satunya elemen yang boleh "bergaya". Sisanya tenang.

### Motion

Hemat. Stage Rail beranimasi saat angka berubah (200ms ease-out). Sheet naik dari bawah. Tidak ada scroll reveal, tidak ada parallax. Hormati `prefers-reduced-motion`.

### Radius & bayangan
Radius 10px untuk kartu, 8px untuk input, 999px untuk chip. Bayangan hanya pada elemen mengambang (sheet, sticky bar). Kartu cukup pakai `--line`.

---

## 3. Aturan tulisan di UI

- Bahasa Indonesia, sentence case, tanpa kata "silakan"
- Tombol menyebut hasilnya: "Simpan laporan", bukan "Submit". Toast setelahnya: "Laporan tersimpan"
- Error menjelaskan apa yang salah dan cara memperbaikinya, bukan minta maaf
  - Benar: "Jumlah stage 47, seharusnya 50. Sisa 3 lead belum masuk kategori."
  - Salah: "Terjadi kesalahan validasi."
- Empty state mengajak bertindak: "Belum ada laporan hari ini. Isi sekarang, sekitar 1 menit."
- Angka besar selalu diformat: `Rp32.900.000`, bukan `32900000`
- Istilah teknis iklan tetap Inggris: CPL, CPP, ROI, CTR, spend, campaign. Sistem ini tidak memakai ROAS, jangan munculkan di UI
- ROI ditulis sebagai persen dengan pemisah titik: `690%`, `2.269%`

---

## 4. Layar prioritas

Kerjakan sesuai urutan. P0 dulu sampai selesai.

### P0 (wajib ada di pass pertama)

**F-01 Login**
Email + password, tombol "Masuk", link "Lupa password". Logo Labbaika. Background navy penuh, kartu putih. Satu layar, tanpa carousel.

**F-02 Beranda CS**
- Header: tanggal hari ini, nama CS
- Kartu status: sudah lapor atau belum. Kalau belum, tombol brass besar "Isi laporan hari ini"
- Ringkas 7 hari terakhir: daftar tanggal + Stage Rail mini + total lead
- Tombol sekunder: "Catat closing"
- Bottom nav 4 item: Beranda, Laporan, Closing, Performa

**F-03 Form laporan harian (layar terpenting)**
- Tanggal di atas, default hari ini, bisa mundur maksimal 7 hari
- Blok source berulang. Tiap blok: dropdown Source, dropdown Campaign (opsional), lalu 4 input angka: Total Lead, Cold, Consultation, Offering
- Kolom **Closing read-only** dengan label kecil "otomatis dari data closing" dan ikon info
- Stage Rail medium di bawah tiap blok, update langsung saat mengetik
- Baris sisa: "Sisa belum dikategorikan: 3" berwarna warn kalau belum nol, ok kalau nol
- Tombol "Tambah source"
- Sticky bottom bar: total lead semua blok + tombol "Simpan laporan"
- Input angka pakai stepper besar (tombol minus/plus di kiri kanan) supaya bisa diisi satu tangan. Keyboard numerik.

**F-04 Sheet Lead Insight**
Muncul dari bawah setelah laporan tersimpan. Judul: "Tambah insight? (opsional)". Tab per stage (Consultation / Offering). Daftar kategori dengan stepper kecil. Counter di atas: "6 dari 7 lead Offering sudah diberi insight". Field catatan bebas. Dua tombol: "Lewati" dan "Simpan insight".

**F-05 Form closing (multi-step)**
Empat langkah dengan progress dots:
1. Customer: nama depan, nama belakang, WhatsApp, email opsional, toggle consent PDP dengan teks penjelas satu kalimat
2. Lead: tanggal lead, source, campaign opsional, dan pertanyaan "Sebelum closing, lead ini ada di stage mana?" default Offering
3. Paket: program, keberangkatan, room type, pax, harga (auto-terisi, bisa dibuka jadi manual lewat toggle "harga khusus" yang memunculkan field catatan), total value tampil besar dengan Plex Mono, status pembayaran, jumlah dibayar
4. Lokasi & review: provinsi, kota, alamat opsional, lalu ringkasan semua isian sebelum "Simpan closing"

**F-06 Modal duplikat**
Muncul kalau nomor WhatsApp sudah ada. Isi: "Nomor ini sudah dicatat closing oleh CS Reza, 21 Agu, Turki 16D Okt." Dua tombol: "Batal" dan "Tetap simpan, butuh persetujuan Owner".

**F-07 Dashboard Owner: Overview**
Desktop dan mobile.
- Baris filter sticky: rentang tanggal, brand, source, campaign, dan **toggle mode attribution** (Cash basis / Cohort) dengan tooltip penjelas
- Empat kartu metrik: Spend, Lead, Closing, Gross Profit
- Satu kartu ROI besar dengan aksen brass, ditempatkan paling menonjol
- Satu kartu ganda **CPP vs Break-even CPP**: dua angka bersebelahan dengan batang tipis yang menunjukkan jaraknya. Hijau kalau CPP jauh di bawah, kuning kalau di atas 70% break-even, merah kalau melewati. Ini kartu keputusan, buat paling mudah dibaca sekilas
- Chip kecil `estimasi` di sebelah ROI kalau `cost_coverage_rate` di bawah 100%, dengan tooltip berisi porsi revenue yang HPP-nya sudah terisi
- Stage Rail besar sebagai funnel, tiap tahap menampilkan angka kumulatif + persen lanjut ke tahap berikut
- Di bawah funnel, baris kecil: "Distribusi akhir lead" berisi bucket mentah, dengan label berbeda supaya tidak tertukar dengan funnel
- Banner kematangan cohort saat mode Cohort aktif: "Cohort Agustus matang 62%. Median closing interval 12 hari."

**F-08 Campaign Quality**
Tabel bisa diurutkan. Kolom: Campaign, Spend, Lead, CPL, % lanjut ke consult, % lanjut ke offering, % offering ke closing, Closing, Gross Profit, CPP, Break-even CPP, ROI. Urutan default berdasarkan ROI menurun. Baris terbaik dan terburuk diberi penanda tipis di sisi kiri, bukan mewarnai seluruh baris. Di mobile berubah jadi kartu bertumpuk.

### P1

**F-09 CS Performance** (untuk Owner, dan versi terbatas untuk CS sendiri)
**F-10 Lead Intelligence**: bar horizontal Top Reason Not Closing, dengan denominator tertulis jelas
**F-11 Reconciliation**: tab Unlinked Closings, CS belum lapor hari ini, laporan gagal validasi
**F-12 Management Report**: filter lengkap + tombol unduh
**F-13a Program cost (owner-only)**: form HPP per program, keberangkatan, dan room type, dengan riwayat seperti timeline harga. Beri penanda visual jelas bahwa layar ini tidak terlihat CS.

**F-13 Export Center**: dua kartu, Operational CSV dan Meta LTV CSV. Kartu Meta menampilkan hitungan: "312 closing, 240 punya consent, yang diekspor 240"
**F-14 Program & Price**: daftar program, keberangkatan, riwayat harga sebagai timeline vertikal
**F-15 Daftar & riwayat laporan CS** dengan status terkunci

### P2

**F-16 Ads data import** (upload CSV + preview mapping)
**F-17 Period lock**
**F-18 Audit log**
**F-19 Manajemen user**

---

## 5. State yang wajib didesain

Untuk setiap layar utama, buat variannya:

- **Loading**: skeleton mengikuti bentuk kontennya, bukan spinner tengah layar
- **Empty**: kalimat pengarah + satu aksi
- **Error**: pesan spesifik + tombol coba lagi
- **Offline / gagal kirim**: banner kuning di atas, "Laporan tersimpan di perangkat. Akan terkirim saat online." Tombol Simpan berubah jadi "Tersimpan lokal"
- **Terkunci periode**: form jadi read-only, banner: "Periode Agustus sudah dikunci. Hubungi Owner untuk membuka."
- **Tanpa akses**: CS membuka URL milik Owner, tampilkan halaman tegas tanpa nada minta maaf

---

## 6. Data mock

Pakai angka ini supaya prototipe terasa nyata dan cocok dengan contoh di PRD.

```json
{
  "cs": [
    { "id": "cs1", "name": "Reza" },
    { "id": "cs2", "name": "Dina" },
    { "id": "cs3", "name": "Fajar" }
  ],
  "today_report": {
    "date": "2026-08-19",
    "blocks": [
      { "source": "Facebook CTWA", "campaign": "CTWA-Turki-Agu",
        "total_lead": 32, "cold": 17, "consultation": 9, "offering": 4, "closing": 2 },
      { "source": "Facebook LP", "campaign": "LP-Umroh-Reguler",
        "total_lead": 14, "cold": 8, "consultation": 4, "offering": 2, "closing": 0 },
      { "source": "Organic", "campaign": null,
        "total_lead": 4, "cold": 0, "consultation": 2, "offering": 1, "closing": 1 }
    ]
  },
  "programs": [
    { "name": "Umroh Turki 16D", "departures": ["2026-10-12", "2026-12-08"],
      "prices": { "quad": 32900000, "triple": 34900000, "double": 37500000 } },
    { "name": "Umroh Reguler 9D", "departures": ["2026-09-20", "2026-11-03"],
      "prices": { "quad": 24900000, "triple": 26500000, "double": 28900000 } },
    { "name": "Umroh Plus Aqsa 13D", "departures": ["2026-11-15"],
      "prices": { "quad": 41500000, "triple": 43900000, "double": 47000000 } }
  ],
  "dashboard_month": {
    "spend": 50000000,
    "lead": 2500,
    "bucket": { "cold": 1400, "consultation": 650, "offering": 300, "closing": 150 },
    "funnel": { "reached_lead": 2500, "reached_consultation": 1100,
                "reached_offering": 450, "reached_closing": 150 },
    "gross_booking_value": 4200000000,
    "collected_revenue": 1310000000,
    "cancellation_rate": 0.04,
    "median_closing_interval_days": 12,
    "cpl": 20000,
    "cpp": 333333,
    "gross_profit": 504000000,
    "margin_pct": 0.12,
    "net_contribution": 454000000,
    "roi": 9.08,
    "breakeven_cpp": 3360000,
    "ad_cost_ratio": 0.0119,
    "cost_coverage_rate": 0.78
  },
  "campaigns": [
    { "name": "CTWA-Turki-Agu", "spend": 5000000, "lead": 500,
      "reached_consultation": 150, "reached_offering": 50, "closing": 10,
      "gross_profit": 39480000, "cpp": 500000, "breakeven_cpp": 3948000, "roi": 6.90 },
    { "name": "LP-Aqsa-Agu", "spend": 5000000, "lead": 250,
      "reached_consultation": 200, "reached_offering": 100, "closing": 30,
      "gross_profit": 118440000, "cpp": 166667, "breakeven_cpp": 3948000, "roi": 22.69 }
  ],
  "top_reason_not_closing": [
    { "label": "Harga", "count": 132 },
    { "label": "Jadwal keberangkatan", "count": 86 },
    { "label": "Program", "count": 70 },
    { "label": "Diskusi keluarga", "count": 49 },
    { "label": "Pembayaran / DP", "count": 37 }
  ],
  "insight_denominator": { "filled": 412, "total_lead": 2500 }
}
```

---

## 7. Batasan teknis

- Mobile first, base 380px. Breakpoint tablet 768px, desktop 1200px
- Target area sentuh minimal 44px
- Semua angka rupiah pakai pemisah titik ala Indonesia
- Tanggal ditulis `19 Agu 2026`, bukan format ISO, kecuali di CSV
- Kontras teks minimal WCAG AA. Warna stage tidak boleh jadi satu-satunya pembeda, selalu ada label
- Fokus keyboard terlihat jelas
- Jangan pakai `localStorage` di prototipe artifact, simpan state di memory saja

---

## 8. Yang tidak perlu dibuat di tahap ini

Autentikasi asli, panggilan API, routing multi-halaman yang kompleks, chart library berat. Grafik cukup dibuat dengan SVG atau div sederhana. Fokusnya arah visual, arsitektur informasi, dan alur, bukan integrasi.

---

## 9. Serah terima

Setelah desain disetujui, keluarkan:
1. Daftar komponen beserta prop-nya (nama komponen final akan dipakai di kode produksi)
2. Token warna, tipografi, spacing dalam bentuk CSS variable siap salin
3. Catatan setiap perilaku interaktif yang tidak terlihat dari tangkapan layar

Hasil ini masuk ke `04-TASKS-ClaudeCode-Major.md` task FE-01 sebagai bahan port ke Next.js.
