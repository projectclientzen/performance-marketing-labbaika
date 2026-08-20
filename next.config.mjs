/** @type {import('next').NextConfig} */
const nextConfig = {
  // Untuk deploy di VPS: menghasilkan .next/standalone berisi server minimal
  // beserta hanya dependensi yang benar-benar dipakai, jadi host tujuan tidak
  // perlu node_modules lengkap. VPS Hermes sudah build dengan opsi ini —
  // menaruhnya di sini supaya repo dan host tidak lagi berbeda diam-diam.
  //
  // Vercel tidak memerlukannya dan mengabaikannya; build di sana tetap jalan
  // (diverifikasi dengan `npm run build` setelah perubahan ini).
  output: "standalone",
};

export default nextConfig;
