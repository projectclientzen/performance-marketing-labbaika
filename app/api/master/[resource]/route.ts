import { NextResponse } from "next/server";
import { getAuthedAppUser } from "@/lib/auth/session";
import { ok, fail, httpStatus } from "@/lib/api/envelope";

const TABLE_MAP: Record<string, string> = {
  sources: "lead_sources",
  "insight-categories": "insight_categories",
  regions: "regions",
};

export async function GET(_request: Request, { params }: { params: Promise<{ resource: string }> }) {
  const { resource } = await params;
  const table = TABLE_MAP[resource];
  if (!table) {
    return NextResponse.json(fail("NOT_FOUND", "Master data tidak dikenal"), {
      status: httpStatus("NOT_FOUND"),
    });
  }

  const { user, supabase } = await getAuthedAppUser();
  if (!user) {
    return NextResponse.json(fail("UNAUTHORIZED"), { status: httpStatus("UNAUTHORIZED") });
  }

  const query =
    table === "regions"
      ? supabase.from(table).select("*").order("name")
      : supabase.from(table).select("*").eq("is_active", true).order("sort_order");

  const { data, error } = await query;
  if (error) {
    console.error("[api/master/[resource]]", error);
    return NextResponse.json(fail("INTERNAL_ERROR"), {
      status: httpStatus("INTERNAL_ERROR"),
    });
  }
  return NextResponse.json(ok(data));
}
