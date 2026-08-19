import { ERROR_CODES } from './enums';

/**
 * Peta pesan error — DS-05.
 * Setiap kode error dipetakan ke kalimat bahasa Indonesia yang menjelaskan
 * cara memperbaikinya. Dipakai oleh DS-12 (envelope API) sebagai pesan default.
 */
export const ERROR_MESSAGES: Record<(typeof ERROR_CODES)[keyof typeof ERROR_CODES], string> = {
  BAD_REQUEST: 'Permintaan tidak valid. Periksa kembali data yang dikirim.',
  VALIDATION_ERROR: 'Ada data yang belum sesuai. Periksa pesan per kolom dan perbaiki.',
  UNAUTHORIZED: 'Sesi berakhir atau token tidak valid. Silakan masuk kembali.',
  FORBIDDEN: 'Akun tidak punya izin untuk aksi ini. Hubungi admin kalau ini keliru.',
  NOT_FOUND: 'Data tidak ditemukan. Pastikan ID atau filter yang dipakai benar.',
  CONFLICT: 'Data bentrok dengan data yang sudah ada. Periksa kembali sebelum menyimpan.',
  RATE_LIMITED: 'Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi.',
  STAGE_UNDERFLOW:
    'Jumlah lead di stage ini tidak cukup. Periksa laporan tanggal tersebut.',
  INTERNAL_ERROR: 'Terjadi kesalahan di server. Coba lagi sebentar lagi, atau hubungi admin.',
};

export function errorMessage(code: keyof typeof ERROR_CODES): string {
  return ERROR_MESSAGES[ERROR_CODES[code]];
}
