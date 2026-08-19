import { NextResponse } from "next/server";
import { getAuthedAppUser } from "@/lib/auth/session";
import { ok, fail, httpStatus } from "@/lib/api/envelope";

export async function GET() {
  const { user, appUser } = await getAuthedAppUser();

  if (!user) {
    return NextResponse.json(fail("UNAUTHORIZED"), { status: httpStatus("UNAUTHORIZED") });
  }
  if (!appUser) {
    return NextResponse.json(fail("NOT_FOUND", "Profil pengguna tidak ditemukan"), {
      status: httpStatus("NOT_FOUND"),
    });
  }

  return NextResponse.json(
    ok({
      id: appUser.id,
      brand_id: appUser.brand_id,
      full_name: appUser.full_name,
      role: appUser.role,
      is_active: appUser.is_active,
      email: user.email,
    }),
  );
}
