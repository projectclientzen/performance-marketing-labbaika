import { getAuthedAppUser } from "@/lib/auth/session";
import { fail, httpStatus } from "@/lib/api/envelope";
import { metaColumns, buildMetaRow } from "@/lib/exports/meta/columns";

const PAGE_SIZE = 1000;

/**
 * Source: closings with pdp_consent = true and payment_status <> cancelled
 * only (04-BRIEF-BE.md §14.2). Hashing happens in buildMetaRow (DS-09
 * normalize.ts), never in this route — keeps the DB layer untouched if
 * Meta's field list changes. `value`/`currency` are added unhashed for
 * value-based audience use, per the same section.
 */
export async function POST(request: Request) {
  const { user, appUser, supabase } = await getAuthedAppUser();
  if (!user) {
    return Response.json(fail("UNAUTHORIZED"), { status: httpStatus("UNAUTHORIZED") });
  }
  if (!appUser) {
    return Response.json(fail("NOT_FOUND", "Profil pengguna tidak ditemukan"), {
      status: httpStatus("NOT_FOUND"),
    });
  }
  if (appUser.role !== "owner") {
    return Response.json(fail("FORBIDDEN"), { status: httpStatus("FORBIDDEN") });
  }

  const body = await request.json().catch(() => ({}));
  const from: string | undefined = body.from;
  const to: string | undefined = body.to;

  const headers = [...metaColumns.map((c) => c.header), "Value", "Currency"];
  let rowCount = 0;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode(headers.join(",") + "\r\n"));

      let offset = 0;
      for (;;) {
        const { data, error } = await supabase.rpc("get_export_meta_ltv", {
          p_brand_id: appUser.brand_id,
          p_from: from ?? null,
          p_to: to ?? null,
          p_offset: offset,
          p_limit: PAGE_SIZE,
        });
        // See app/api/exports/operational/route.ts for why error and
        // empty-data can't share a `break`: a silent break here would hand
        // Meta a truncated audience list that looks like a complete one.
        if (error) {
          console.error("[api/exports/meta-ltv]", error);
          controller.error(new Error("Export gagal"));
          return;
        }
        if (!data || data.length === 0) break;

        for (const row of data) {
          const hashedRow = buildMetaRow({
            phone: row.phone,
            email: row.email,
            name: row.name,
            city: row.city,
            state: row.state,
          });
          const cells = [
            ...metaColumns.map((c) => hashedRow[c.header]),
            String(row.total_value ?? ""),
            "IDR",
          ].map((v) => (/[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v));
          controller.enqueue(encoder.encode(cells.join(",") + "\r\n"));
          rowCount++;
        }

        if (data.length < PAGE_SIZE) break;
        offset += PAGE_SIZE;
      }

      await supabase.from("export_logs").insert({
        brand_id: appUser.brand_id,
        user_id: appUser.id,
        export_type: "meta_ltv",
        filters: { from, to },
        row_count: rowCount,
      });

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="meta-ltv-${Date.now()}.csv"`,
    },
  });
}
