/**
 * URL dan anon key Supabase.
 *
 * Keduanya PUBLIK secara desain: anon key dikirim ke setiap browser lewat
 * bundle klien, dan yang menjaga data adalah RLS, bukan kerahasiaan key ini
 * (service role key yang rahasia tetap hanya di env server). Karena aplikasi
 * ini satu project Supabase (single-tenant), nilainya dipatok di sini sebagai
 * sumber kebenaran tunggal.
 *
 * Alasan dipatok, bukan dari env: NEXT_PUBLIC_* di VPS sempat salah nilai dan
 * membuat login gagal berhari-hari — GoTrue menolak apikey, lalu tampil sebagai
 * error 500 yang membingungkan. Dengan dipatok, build mana pun pasti benar dan
 * tidak bisa lagi rusak oleh env yang salah. Kalau suatu saat perlu pindah
 * project, ubah dua baris ini (dan service role di env server).
 */
export const SUPABASE_URL = "https://ymnttmqfwzrhqpnewbeo.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltbnR0bXFmd3pyaHFwbmV3YmVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxMzM4MjcsImV4cCI6MjEwMjcwOTgyN30.cZotypHQPM9F6HV_t9k5Gpo8qyWKHw9epqeO-VfWNJk";
