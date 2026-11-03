# Bukti validasi lokal — 7 Oktober 2026

Baseline `048df9373c669e001d4dcd4a1ce70e13cfa83e81`, branch lokal `codex/labbaika-capi-booking-value`. Tidak ada deployment, migrasi produksi, perubahan campaign, atau pengiriman event Meta nyata pada pekerjaan ini. Tidak ada file closing September asli yang diproses.

## Hasil

| Pemeriksaan | Hasil aktual |
|---|---|
| `npm test` | **145 tests lulus pada 25 files**; meliputi pengujian lama dan tambahan CAPI |
| `npm run typecheck` | Lulus |
| `npm run lint` | 0 error; 1 warning lama pada font di `app/layout.tsx` |
| `npm run build` | Lulus, Next.js 14.2.35; rute CAPI dan halaman monitoring tercakup |
| Bootstrap + seluruh migrations | Lulus pada PostgreSQL lokal disposable |
| Seluruh `tests/sql/0*.sql` selain bootstrap | **21 files lulus** |
| Rollback032 lalu reapply032 | Lulus; timestamp yang dikumpulkan tetap dipertahankan |
| CLI sintetis, clock 30 September | 1 layak, booking value Rp60.000.000, nominal terbayar Rp10.000.000 |
| Fixture sama, clock 7 Oktober | 0 layak, 1 terlalu tua menurut kebijakan sementara7 hari |
| Whitespace/diff check | Lulus |

Lingkungan lokal menggunakan Node.js25.2.1 dan PostgreSQL14.21. CI repository menargetkan Node20/PostgreSQL15; **CI GitHub belum dijalankan untuk perubahan ini**. Dependencies lokal disalin dari checkout project yang tersedia; tidak ada dependency baru. Runtime/dependency fresh install dan versi deployment perlu diperiksa Hermes sebelum rollout.

Build menampilkan warning optimasi Google Fonts yang tidak dapat diunduh pada lingkungan ini, warning cache webpack, dan log dynamic-server pada health route lama saat prerender. Build berakhir exit0. Ini bukan bukti bahwa tampilan dan login production telah diuji end-to-end.

## Apa yang dicakup tests baru

- DP positif menghasilkan full booking value; status batal/refund/nol/kelebihan bayar/lunas tidak sesuai ditolak.
- Consent dan waktu asli wajib, masa depan/umur/lead date diperiksa, timestamp PostgreSQL mikrodetik diterima.
- Snapshot/event ID stabil; payload meminimalkan identitas, tidak mengirim nama paket atau mengasumsikan negara pelanggan dari nomor.
- CSV dengan quotes, format salah, duplikat dan keluaran agregat tanpa PII.
- Worker autentikasi, route-verified gate, dry-run, dataset pinned, brand-specific claim, nilai snapshot, consent, lease dicabut/kedaluwarsa dan completion_unknown.
- Sender test/live, token header, redirect ditolak, respons sukses tidak cukup tanpa penerimaan, rate limit dan hasil ambigu dibedakan.
- PATCH CS memakai view tanpa kolom updated_by yang tidak tersedia; presisi timestamp tidak dipotong pada perubahan cicilan.
- SQL: off/no backfill, full value, isolasi CS/brand/HRD, larangan mutasi queue dari CS, satu event saat cicilan, lease tidak diklaim ulang, completion lama ditolak, refund/consent revoke, koreksi identitas/nilai ditahan, dry-run tidak dikirim dan tidak dipromosikan ke live.

Unit worker memakai database dan transport mock. SQL menguji constraint/RLS dengan impersonasi role lokal. Tes lease berurutan membuktikan state tidak diklaim ulang; **uji dua proses scheduler yang benar-benar bersamaan masih termasuk H06**, bersama pengujian Supabase/Auth/Meta aktual.

## Batas yang belum diverifikasi

1. Tampilan mobile/desktop dan alur login/CS/owner dengan sesi staging nyata.
2. API Meta versi aktif, aset/izin, batas umur/dedup, serta kemampuan Test Events pada route akun.
3. Coexistence untuk nomor pengguna, webhook asli, ctwa_clid dan relasi conversation ke booking.
4. Event produksi accepted, campaign attribution, serta dampak optimasi/CPA/ROAS.
5. Kualitas dan jumlah closing September asli.
6. Held reconciliation manual, persistent run log dan audit perubahan setting CAPI yang lebih lengkap (O02/O03).

Tidak satu pun batas tersebut dinyatakan selesai hanya karena unit test atau build lulus.

## Reproduksi

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run capi:trial -- lib/capi/fixtures/synthetic-closing.json --now 2026-09-30T05:00:00Z
npm run capi:trial -- lib/capi/fixtures/synthetic-closing.json --now 2026-10-07T05:00:00Z
```

Untuk SQL gunakan database **kosong disposable**, bukan project Supabase produksi. Ikuti urutan pada `.github/workflows/ci.yml`: bootstrap lokal → setiap `supabase/migrations/0*.sql` urut nama → setiap test SQL selain bootstrap. Semua perintah memakai `ON_ERROR_STOP=1`. Rollback032 hanya diuji pada database disposable; rollback operasional produksi adalah mode off dan stop worker dengan audit tetap tersimpan.
