import { NextResponse } from "next/server";
import { getAuthedAppUser } from "@/lib/auth/session";
import { hasOwnerAccess } from "@/lib/auth/roles";
import { ok, fail, httpStatus } from "@/lib/api/envelope";

const PAGE_SIZE = 50;

export async function GET(request: Request) {
  const { user, appUser, supabase } = await getAuthedAppUser();
  if (!user) {
    return NextResponse.json(fail("UNAUTHORIZED"), { status: httpStatus("UNAUTHORIZED") });
  }
  if (!appUser || !hasOwnerAccess(appUser.role)) {
    return NextResponse.json(fail("FORBIDDEN"), { status: httpStatus("FORBIDDEN") });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("user");
  const table = searchParams.get("table");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const cursor = searchParams.get("cursor"); // created_at of the last row from the previous page

  // app_users:user_id(full_name) — F-18 shows "Reza Simpan laporan harian
  // 19 Agu" style messages, which need the actor's name, not just their
  // id. RLS on app_users already lets an owner read every user in their
  // own brand (owner_all policy), so this is a normal joined SELECT
  // through the caller's own client, no elevated access involved.
  let query = supabase
    .from("audit_logs")
    .select("*, app_users:user_id(full_name)")
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);

  if (userId) query = query.eq("user_id", userId);
  if (table) query = query.eq("table_name", table);
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);
  if (cursor) query = query.lt("created_at", cursor);

  const { data, error } = await query;
  if (error) {
    console.error("[api/audit-logs]", error);
    return NextResponse.json(fail("INTERNAL_ERROR"), {
      status: httpStatus("INTERNAL_ERROR"),
    });
  }

  const nextCursor = data && data.length === PAGE_SIZE ? data[data.length - 1].created_at : null;
  return NextResponse.json(ok(data, { next_cursor: nextCursor }));
}
