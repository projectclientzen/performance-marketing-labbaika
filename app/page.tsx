import { redirect } from "next/navigation";
import { getAuthedAppUser } from "@/lib/auth/session";
import { hasOwnerAccess } from "@/lib/auth/roles";

/**
 * `/` tidak punya isi sendiri — ia cuma mengantar ke dashboard yang sesuai
 * peran. Sebelumnya halaman ini masih placeholder scaffold ("Bootstrap OK,
 * lihat /api/health"), jadi siapa pun yang membuka domain utama sesudah login
 * mendarat di halaman kosong yang terlihat seperti aplikasinya rusak.
 *
 * Middleware sudah memastikan ada sesi sebelum sampai sini (yang belum login
 * dilempar ke /login), jadi yang tersisa hanya soal tujuan. appUser null
 * artinya identitas auth-nya ada tapi barisnya belum dibuat di app_users —
 * kasus nyata saat onboarding, dan /no-access sudah menjelaskannya.
 */
export default async function HomePage() {
  const { appUser } = await getAuthedAppUser();

  if (!appUser) redirect("/no-access");
  redirect(hasOwnerAccess(appUser.role) ? "/owner" : "/cs");
}
