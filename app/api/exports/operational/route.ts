import { getAuthedAppUser } from "@/lib/auth/session";
import { fail, httpStatus } from "@/lib/api/envelope";
import { operationalColumns } from "@/lib/exports/operational/columns";
import { PAYMENT_STATUS } from "@/lib/constants/enums";

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

  // p_status is a payment_status enum on the DB side — an unvalidated value
  // would surface as a Postgres enum error mid-stream, which (see below)
  // reads to the client as a truncated-but-successful CSV. Reject up front
  // instead.
  if (status !== undefined && !(status in PAYMENT_STATUS)) {
    return Response.json(fail("VALIDATION_ERROR", "status tidak valid", { status }), {
      status: httpStatus("VALIDATION_ERROR"),
    });
  }

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
        const { data, error } = await supabase.rpc("get_export_operational", {
          p_brand_id: appUser.brand_id,
          p_from: from ?? null,
          p_to: to ?? null,
          p_cs: csId ?? null,
          p_program: programId ?? null,
          p_source: sourceId ?? null,
          p_status: status ?? null,
          p_offset: offset,
          p_limit: PAGE_SIZE,
        });
        // A mid-stream error must NOT look like a clean end-of-data: the
        // header (and possibly prior pages) are already flushed, so a
        // silent `break` here would hand the owner a 200 OK CSV that's
        // quietly missing rows, with no way to tell it apart from a
        // complete export. controller.error() breaks the download instead
        // — worse UX, but an honest failure beats a wrong number.
        if (error) {
          console.error("[api/exports/operational]", error);
          controller.error(new Error("Export gagal"));
          return;
        }
        if (!data || data.length === 0) break;

        for (const row of data) {
          const mapped = {
            lead_date: row.lead_date,
            name: row.name,
            whatsapp: row.whatsapp,
            city: row.city,
            source: sourceNameById.get(row.source_id) ?? "",
            stage: row.stage,
            closing_date: row.closing_date,
            program: row.program,
            room_type: row.room_type,
            pax: row.pax,
            total_value: row.total_value,
            paid_amount: row.paid_amount,
            status: row.status,
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
