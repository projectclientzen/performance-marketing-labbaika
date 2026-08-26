import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedAppUser } from "@/lib/auth/session";
import { hasOwnerAccess } from "@/lib/auth/roles";
import { ok, fail, httpStatus } from "@/lib/api/envelope";

const patchSchema = z.object({
  is_active: z.boolean().optional(),
  name: z.string().trim().min(1).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, appUser, supabase } = await getAuthedAppUser();
  if (!user) return NextResponse.json(fail("UNAUTHORIZED"), { status: httpStatus("UNAUTHORIZED") });
  if (!appUser || !hasOwnerAccess(appUser.role)) {
    return NextResponse.json(fail("FORBIDDEN"), { status: httpStatus("FORBIDDEN") });
  }
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(fail("VALIDATION_ERROR", "Data tidak valid"), {
      status: httpStatus("VALIDATION_ERROR"),
    });
  }
  const { data, error } = await supabase
    .from("lead_sources")
    .update(parsed.data)
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) {
    console.error("[api/lead-sources/[id]] PATCH", error);
    return NextResponse.json(fail("INTERNAL_ERROR"), { status: httpStatus("INTERNAL_ERROR") });
  }
  if (!data) return NextResponse.json(fail("NOT_FOUND", "Sumber tidak ditemukan"), { status: httpStatus("NOT_FOUND") });
  return NextResponse.json(ok(data));
}
