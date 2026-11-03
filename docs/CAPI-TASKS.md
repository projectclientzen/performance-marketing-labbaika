# Backlog kecil dan pembagian kerja CAPI

Status diperbarui 4 November 2026 oleh Claude Code (audit P0.2 + P1.1–P1.3; lihat C22–C25 dan O01–O03). Status awal 7 Oktober 2026. `Selesai lokal` berarti file dibuat dan pemeriksaan lokal yang relevan lulus; bukan sudah dipasang di produksi. `Menunggu Hermes` berarti bergantung akun, konfigurasi lingkungan, atau sumber data. Subagen sempat mengerjakan core, outbox dan riset, lalu terhenti karena batas kredit workspace; integrasi dan pengujian diteruskan agen utama.

## Fase 1 — kode dan spesifikasi

| ID | Task / hasil konkret | Dependensi | Pemilik | Status |
|---|---|---|---|---|
| C01 | Cocokkan GitHub dan checkout, isolasi branch dari baseline 048df937 | — | Codex | Selesai lokal |
| C02 | PRD full booking value saat DP pertama | Keputusan pengguna | Codex | Selesai lokal |
| C03 | Pisahkan generic chat vs CTWA serta accepted vs attributed | Riset primer | Codex | Selesai lokal; kontrak akun H02 |
| C04 | Validator positif, consent, status, harga × pax, override | C02 | Codex | Selesai lokal |
| C05 | Timestamp pembayaran asli, WIB/UTC dan presisi PostgreSQL | C04 | Codex | Selesai lokal |
| C06 | Payload hash phone/email minimum dan stable event ID | C04–05 | Codex | Selesai lokal |
| C07 | CSV/JSON simulator tanpa network, output agregat | C04 | Codex | Selesai lokal |
| C08 | Tambahan timestamp pada form dan edit closing | C05 | Codex | Selesai lokal; UAT H06 |
| C09 | ID submission stabil per draft untuk mencegah retry membuat booking baru | C08 | Codex | Selesai lokal |
| C10 | Migration032: settings/outbox dan view CS kompatibel | C05 | Codex | Selesai lokal |
| C11 | Trigger atomik: first DP saja, tidak backfill, tidak promote test | C10 | Codex | Selesai lokal |
| C12 | Hold saat identitas/nilai/waktu berubah; cancel saat ineligible | C11 | Codex | Selesai lokal |
| C13 | Claim/completion RPC: scope brand, skip locked, lease, attempt cap | C11 | Codex | Selesai lokal |
| C14 | Sender terautentikasi, test/live gate, klasifikasi hasil ambigu | C06 | Codex | Selesai lokal |
| C15 | Endpoint worker: recheck eligibility/mode/lease dan completion | C13–14 | Codex | Selesai lokal |
| C16 | Settings API owner/advertiser; event list owner/CS dengan RLS | C10 | Codex | Selesai lokal |
| C17 | Monitor owner dan status per booking CS | C16 | Codex | Selesai lokal; UAT H06 |
| C18 | Unit tests aturan, sender, worker, schema dan waktu | C04–17 | Codex | Selesai lokal |
| C19 | Seluruh SQL tests + rollback/reapply database disposable | C10–13 | Codex | Selesai lokal |
| C20 | Build/typecheck/lint dan catatan batas pengujian | C18–19 | Codex | Lihat VALIDATION-CAPI.md |
| C21 | Handoff, kontrak export September, task/context, arsip tanpa secrets | C01–20 | Codex | Selesai lokal |
| C22 | Fix: booking batal/consent dicabut/nilai berubah saat event `processing` tidak lagi menghapus penerimaan Meta. Baris ditahan (`held`) dengan lease tetap; completion terlambat tercatat sebagai `accepted` + `accepted_after_booking_change` | C11–13 | Claude Code | Selesai lokal; dibuktikan repro + SQL test |
| C23 | Fix: booking yang tidak layak saat insert (mis. total ≠ harga × pax) lalu dikoreksi kini masuk antrean satu kali. Guard parsial dihapus; duplikat/backfill tetap dijaga `exists()` + waktu aktivasi | C11 | Claude Code | Selesai lokal; dibuktikan repro + SQL test |
| C24 | Pesan 422 untuk SQLSTATE 23514 membedakan aturan pembayaran CAPI dari CHECK constraint lain (`lib/api/check-violation.ts`) | C10 | Claude Code | Selesai lokal |
| C25 | Workspace `node_modules` korup (binary rolldown hilang) dipulihkan dengan `npm ci` | — | Claude Code | Selesai lokal |

## Integrasi Hermes — urutan yang dapat dikerjakan

| ID | Task | Dependensi | Selesai bila |
|---|---|---|---|
| H01 | Baca deployment aktual dan inventaris aset | C21, akses akun | Matriks hosting/business/ad account/Page/dataset/WA terisi |
| H02 | Verifikasi route/version/umur/test/dedup | H01 | Kontrak API terkonfirmasi beserta sumber/tanggal |
| H03 | Periksa consent, category restrictions, allowlist field | H01–02 | Keputusan field dan eligibility terdokumentasi |
| H04 | Periksa coexistence atau provider WhatsApp resmi | H01 | Opsi nyata, biaya, dampak CS dan kelayakan nomor |
| H05 | Konfigurasi staging/test secrets; jangan mengubah public Supabase config sembarang | H02–03 | Target environment dan aset diverifikasi |
| H06 | Backup, migration032 staging, UI UAT, scheduler test dan concurrent worker | H05 | Bukti isolasi dan satu event per booking; rollback diuji |
| H07 | Fixture baru → Test Events | H02, H06 | Payload/value/time dan penerimaan terbukti |
| H08 | Jalur WhatsApp resmi → referral asli → booking | H04, W01–06 | Click ID asli dengan provenance; ambiguity ditangani |
| H09 | Baca goal/ad set/attribution settings | H01–02 | Fitur tersedia dan pilihan aktual, bukan asumsi |
| H10 | Export Excel/JSON/CSV September dan trial offline | C07, data pengguna | Rekonsiliasi dan laporan agregat; nol kirim Meta |
| H11 | Siapkan pilot transaksi baru, batas jumlah dan rollback | H03, H07–09 | Pilot siap ditinjau, dependensi terpenuhi |
| H12 | Aktivasi pilot sesuai keputusan pengguna | H11 | Accepted, attributed, optimization dilaporkan terpisah |
| H13 | Runbook harian, alert, secret rotation dan reconciliation | H12 | Owner operasional jelas, error tidak tersembunyi |

Semua H01–H13 **belum dijalankan pada akun produksi**. H10 bisa berjalan paralel dengan H01–04. H08/H09 diperlukan untuk klaim CTWA/optimasi; pilot generic chat hanya boleh memakai kontrak serta tujuan pengukuran yang diverifikasi, tanpa klaim CTWA.

## Fase 2 — pembangunan CTWA setelah kontrak tersedia

| ID | Task kecil | Prasyarat | Uji penerimaan |
|---|---|---|---|
| W01 | Schema kontak, conversation/referral dan relasi booking per brand/nomor bisnis | H04, data payload asli tersamarkan | Banyak referral per kontak; isolasi brand/nomor |
| W02 | Endpoint webhook HTTPS: challenge + signature Meta | H02/H04 | Signature salah ditolak; secret tidak masuk log |
| W03 | Parser referral + dedup message ID + provenance | W01–02 | Replay tidak duplikat; pesan telat tidak menimpa link terkunci |
| W04 | Resolusi identitas kontak dan CS confirmation untuk kasus ambigu | W03 | Satu nomor dua booking tidak asal dipilih referral terakhir |
| W05 | Adapter business_messaging/whatsapp terpisah dari generic chat | H02, W04 | Required fields route terpenuhi; missing click ID ditahan |
| W06 | Uji end-to-end klik iklan asli → chat → DP → Meta | W05, H07 | Rantai data internal benar, hasil Meta diukur terpisah |

Status W01–W06: **dirancang, belum diimplementasikan**. Jangan menandai selesai karena CAPI generic chat berhasil mengirim.

## Fase 3 dan task tambahan

| ID | Task | Status/prasyarat |
|---|---|---|
| M01 | Import metrics Purchase/value Ads Insights sesuai action type akun | Backlog; H09 |
| M02 | Panel banding booking value, cash, delivery dan attributed values | Backlog; M01 |
| M03 | Desain eksperimen CPA booking/ROAS/cancellation, cohort setara | Backlog; izin eksperimen dan baseline |
| O01 | Coverage monitor booking yang belum masuk antrean beserta alasan | **Selesai lokal** (4 Nov): RPC `capi_coverage` (owner/advertiser, brand sendiri, read-only), `GET /api/capi/monitor`, panel di `/owner/capi`. Tidak mendaftarkan transaksi lama. Validitas nomor/email hanya dicek TS → muncul sebagai event `held`, bukan di coverage |
| O02 | UI reconciliation untuk held/hasil ambigu dengan audit dan guard dedup | **Selesai lokal** (4 Nov): RPC `resolve_capi_event` + `POST /api/capi/events/[id]/resolve`. Dua keputusan saja: dikonfirmasi diterima → `accepted`, dikonfirmasi tidak diterima → `cancelled`. Catatan bukti wajib, diaudit ke `audit_logs`. **Tetap tanpa tombol resend** sampai H02 memastikan kontrak dedup Meta. Prosedur pemeriksaan di Meta oleh Hermes (H13) |
| O03 | Audit perubahan settings CAPI dan detail run worker persisten | **Selesai lokal** (4 Nov): trigger `capi_settings_audit` (aktor, mode/dataset lama-baru) dan tabel `capi_worker_runs` (hitungan + kode, tanpa payload/token/PII) sebagai heartbeat; monitor memperingatkan bila worker tak jalan 15 menit atau ada `completion_unknown` |
| O04 | Upload/map XLSX langsung dalam dashboard | Backlog; saat ini konversi file oleh Hermes |
| O05 | Audit export/analytics lama untuk refund dan duplikat booking manual | Backlog terpisah, menjaga definisi report lama |

## Aturan pengerjaan paralel

Core validator dikerjakan terpisah dari SQL/outbox; riset Hermes tidak mengubah business rule. Setelah kontrak disepakati, satu agen integrasi menangani API/UI dan menguji keseluruhan. Hindari dua agen mengedit migration/API yang sama. Setiap task: baca context → ubah file ruang lingkupnya → uji yang relevan → laporkan file, bukti, dan dependensi. Jangan memakai status done untuk pekerjaan akun yang hanya tertulis di dokumen.
