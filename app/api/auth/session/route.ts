import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ok, fail, httpStatus } from "@/lib/api/envelope";

const loginSchema = z.object({
  email: z.string().email("Email tidak valid"),
  password: z.string().min(1, "Password wajib diisi"),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fields[issue.path.join(".") || "body"] = issue.message;
    }
    return NextResponse.json(fail("VALIDATION_ERROR", undefined, fields), {
      status: httpStatus("VALIDATION_ERROR"),
    });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error || !data.user) {
    // Dulu SEMUA kegagalan jadi satu pesan "Email atau password salah",
    // termasuk rate-limit dan salah konfigurasi anon key/URL Supabase. Itu
    // pernah menyamarkan env VPS yang salah sebagai "password salah" dan
    // memakan waktu berjam-jam untuk didiagnosa. Sekarang dibedakan — tanpa
    // membocorkan apakah email terdaftar (kredensial salah tetap generik).
    const code = (error as { code?: string; status?: number } | null)?.code;
    const status = (error as { status?: number } | null)?.status;

    if (code === "email_not_confirmed") {
      return NextResponse.json(fail("UNAUTHORIZED", "Email belum dikonfirmasi. Hubungi owner."), {
        status: httpStatus("UNAUTHORIZED"),
      });
    }
    if (status === 429 || code === "over_request_rate_limit") {
      return NextResponse.json(
        fail("RATE_LIMITED", "Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi."),
        { status: httpStatus("RATE_LIMITED") },
      );
    }
    // invalid_credentials (400) memang password/email salah — biarkan generik.
    // Selain itu (apikey/URL salah, GoTrue down, dsb) bukan salah pengguna:
    // catat pesan aslinya di server supaya bisa dilacak, tampilkan pesan beda.
    if (code !== "invalid_credentials" && status !== 400) {
      console.error("[api/auth/session] login gagal non-kredensial:", error);
      return NextResponse.json(
        fail("INTERNAL_ERROR", "Layanan masuk sedang bermasalah. Hubungi admin."),
        { status: httpStatus("INTERNAL_ERROR") },
      );
    }
    return NextResponse.json(fail("UNAUTHORIZED", "Email atau password salah"), {
      status: httpStatus("UNAUTHORIZED"),
    });
  }

  return NextResponse.json(ok({ user_id: data.user.id }));
}

export async function DELETE() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.json(ok({ signed_out: true }));
}
