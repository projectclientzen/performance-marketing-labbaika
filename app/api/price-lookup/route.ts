import { NextResponse } from "next/server";
import { getAuthedAppUser } from "@/lib/auth/session";
import { ok, fail, httpStatus } from "@/lib/api/envelope";

/**
 * Powers the closing wizard's price prefill (F-05 step 3). Precedence: a
 * price row scoped to this exact departure wins over a departure-agnostic
 * one. Dulu ini mencerminkan trigger T-7 untuk HPP (migrasi 008); T-7 dan
 * seluruh jalur biaya dibuang migrasi 023, aturan presedensinya tetap.
 */
export async function GET(request: Request) {
  const { user, appUser, supabase } = await getAuthedAppUser();
  if (!user) {
    return NextResponse.json(fail("UNAUTHORIZED"), { status: httpStatus("UNAUTHORIZED") });
  }
  if (!appUser) {
    return NextResponse.json(fail("NOT_FOUND", "Profil pengguna tidak ditemukan"), {
      status: httpStatus("NOT_FOUND"),
    });
  }

  const { searchParams } = new URL(request.url);
  const programId = searchParams.get("program_id");
  const departureId = searchParams.get("departure_id");
  const roomType = searchParams.get("room_type");
  const date = searchParams.get("date");

  if (!programId || !roomType || !date) {
    return NextResponse.json(
      fail("VALIDATION_ERROR", "program_id, room_type, dan date wajib diisi"),
      { status: httpStatus("VALIDATION_ERROR") },
    );
  }

  let query = supabase
    .from("program_prices")
    .select("*")
    .eq("program_id", programId)
    .eq("room_type", roomType)
    .eq("status", "active")
    .lte("effective_date", date)
    .or(`end_date.is.null,end_date.gte.${date}`);

  if (departureId) {
    query = query.or(`departure_id.eq.${departureId},departure_id.is.null`);
  } else {
    query = query.is("departure_id", null);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[api/price-lookup]", error);
    return NextResponse.json(fail("INTERNAL_ERROR"), {
      status: httpStatus("INTERNAL_ERROR"),
    });
  }

  if (!data || data.length === 0) {
    return NextResponse.json(fail("PRICE_NOT_FOUND", "Harga tidak ditemukan untuk kombinasi ini"), {
      status: httpStatus("PRICE_NOT_FOUND"),
    });
  }

  // Prefer the row scoped to this exact departure_id, if more than one matched.
  const best =
    data.find((row) => row.departure_id === departureId) ?? data[0];

  return NextResponse.json(ok(best));
}
