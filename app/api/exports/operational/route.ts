import { getAuthedAppUser } from "@/lib/auth/session";
import { fail, httpStatus } from "@/lib/api/envelope";
import { operationalColumns } from "@/lib/exports/operational/columns";

const PAGE_SIZE = 1000;

/**
 * Streams v_closing_enriched a page at a time instead of loading the full
 * result set into memory — CC-B24 "selesai kalau: 50.000 baris terunduh
 * tanpa lonjakan memori". Row shape is adapted to what
 * lib/exports/operational/columns.ts (DS-17) already expects; not
 * rewriting that file, just mapping into its accessor contract.
 *
 * Column set here is closing-level (one row per closing), matching DS-17's
 * existing config — the brief's §14.1 combined daily-report-plus-closing
 * format is not implemented; flagging that gap rather than guessing at it.
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
  const csId: string | undefined = body.cs;
  const programId: string | undefined = body.program;
  const sourceId: string | undefined = body.source;
  const status: string | undefined = body.status;

  const { data: sources } = await supabase.from("lead_sources").select("id, name");
  const sourceNameById = new Map((sources ?? []).map((s: { id: string; name: string }) => [s.id, s.name]));

  const headers = operationalColumns.map((c) => c.header);
  let rowCount = 0;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode("﻿" + headers.join(",") + "\r\n"));

      let offset = 0;
      for (;;) {
        let query = supabase
          .from("v_closing_enriched")
          .select("*")
          .eq("brand_id", appUser.brand_id)
          .order("closing_date", { ascending: false })
          .range(offset, offset + PAGE_SIZE - 1);

        if (from) query = query.gte("closing_date", from);
        if (to) query = query.lte("closing_date", to);
        if (csId) query = query.eq("cs_id", csId);
        if (programId) query = query.eq("program_id", programId);
        if (sourceId) query = query.eq("source_id", sourceId);
        if (status) query = query.eq("payment_status", status);

        const { data, error } = await query;
        if (error || !data || data.length === 0) break;

        for (const row of data) {
          const mapped = {
            lead_date: row.lead_date,
            name: [row.first_name, row.last_name].filter(Boolean).join(" "),
            whatsapp: row.whatsapp_e164,
            city: row.city_name,
            source: sourceNameById.get(row.source_id) ?? "",
            stage: "closing",
            closing_date: row.closing_date,
            program: row.program_name,
            room_type: row.room_type,
            pax: row.pax,
            total_value: row.total_value,
            paid_amount: row.paid_amount,
            status: row.payment_status,
          };
          const cells = operationalColumns.map((c) => {
            const raw = c.accessor(mapped);
            const value = c.format ? c.format(raw) : String(raw ?? "");
            return /[",\r\n]/.test(value) ? '"' + value.replace(/"/g, '""') + '"' : value;
          });
          controller.enqueue(encoder.encode(cells.join(",") + "\r\n"));
          rowCount++;
        }

        if (data.length < PAGE_SIZE) break;
        offset += PAGE_SIZE;
      }

      await supabase.from("export_logs").insert({
        brand_id: appUser.brand_id,
        user_id: appUser.id,
        export_type: "operational",
        filters: { from, to, cs: csId, program: programId, source: sourceId, status },
        row_count: rowCount,
      });

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="operational-${Date.now()}.csv"`,
    },
  });
}
