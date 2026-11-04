/**
 * Pesan untuk SQLSTATE 23514 (check_violation) dari tabel closings. Kode yang
 * sama datang dari dua sumber: trigger pembayaran CAPI (migrasi 032, pesannya
 * menyebut "payment") dan CHECK constraint lama (harga, override, consent).
 * Pesan pembayaran untuk constraint lain menyesatkan CS, jadi dipisah.
 */
export function checkViolationMessage(dbMessage: string): string {
  return /payment/i.test(dbMessage)
    ? "Periksa nilai dan waktu pembayaran yang sebenarnya."
    : "Data closing belum memenuhi aturan: periksa harga, catatan harga khusus, dan waktu persetujuan data.";
}
