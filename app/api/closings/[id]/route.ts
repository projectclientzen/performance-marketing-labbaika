import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedAppUser } from "@/lib/auth/session";
import { ok, fail, httpStatus } from "@/lib/api/envelope";

// Explicit allow-list, not a passthrough of the request body. Alasan aslinya
// adalah mencegah cs mem-PATCH HPP-nya sendiri; kolom biaya itu sudah tidak ada
// sejak migrasi 023, tapi daftar putihnya tetap dipertahankan. Meneruskan field
// sembarang dari klien ke UPDATE tetap salah bentuk — brand_id, cs_id,
// price_at_transaction, dan total_value bukan milik pemanggil untuk diubah.
const patchSchema = z.object({
  last_name: z.string().optional(),
  email: z.string().email().optional(),
  payment_status: z.enum(["dp", "partial", "lunas", "refunded"]).optional(),
  paid_amount: z.number().int().nonnegative().optional(),
  price_note: z.string().optional(),
  province_id: z.string().optional(),
  city_id: z.string().optional(),
  address: z.string().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, appUser, supabase } = await getAuthedAppUser();

  if (!user) {
    return NextResponse.json(fail("UNAUTHORIZED"), { status: httpStatus("UNAUTHORIZED") });
  }
  if (!appUser) {
    return NextResponse.json(fail("NOT_FOUND", "Profil pengguna tidak ditemukan"), {
      status: httpStatus("NOT_FOUND"),
    });
  }

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fields[issue.path.join(".") || "body"] = issue.message;
    }
    return NextResponse.json(fail("VALIDATION_ERROR", undefined, fields), {
      status: httpStatus("VALIDATION_ERROR"),
    });
  }

  // S0-02 (07-AUDIT-REPO.md): two separate problems, both fixed here.
  // (1) no .select() — cs has no SELECT policy on closings, so
  //     .update().select() compiles to UPDATE ... RETURNING and fails RLS
  //     outright. { count: "exact" } avoids RETURNING entirely.
  // (2) cs still can't be routed at the base table: UPDATE needs row-level
  //     SELECT visibility to find candidate rows at all, independent of
  //     RETURNING — cs has none on `closings` (by design, that's what
  //     hides HPP), so `UPDATE closings ... WHERE id=$1` matches 0 rows
  //     for a cs even on their own data (confirmed against the live
  //     project: 204, count 0, nothing changed). v_closings_cs (migration
  //     013) is auto-updatable (single table, no aggregates) — routing
  //     through it lets Postgres's view-rewriter reach the base table
  //     under the view's own privileges, so cs never needs direct table
  //     SELECT, and the view's column list already excludes every cost
  //     column regardless. Owner already works via the base table
  //     (closings_owner_all covers SELECT), so only cs needs the view.
  const table = appUser.role === "cs" ? "v_closings_cs" : "closings";
  const { error, count } = await supabase
    .from(table)
    .update({ ...parsed.data, updated_by: appUser.id }, { count: "exact" })
    .eq("id", id);

  if (error) {
    if (error.message.includes("sudah dikunci")) {
      return NextResponse.json(fail("PERIOD_LOCKED", error.message), {
        status: httpStatus("PERIOD_LOCKED"),
      });
    }
    if (error.message.includes("closing_paid")) {
      return NextResponse.json(fail("VALIDATION_ERROR", "paid_amount melebihi total_value"), {
        status: httpStatus("VALIDATION_ERROR"),
      });
    }
    console.error("[api/closings/:id] PATCH", error);
    return NextResponse.json(fail("INTERNAL_ERROR"), {
      status: httpStatus("INTERNAL_ERROR"),
    });
  }

  if (!count) {
    return NextResponse.json(fail("NOT_FOUND", "Closing tidak ditemukan"), {
      status: httpStatus("NOT_FOUND"),
    });
  }

  return NextResponse.json(ok({ id }));
}
