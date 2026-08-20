"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import { formatDateID, todayJakarta } from "@/lib/utils/date";
import { Banner } from "@/components/ui/Banner";

interface UnlinkedClosing {
  id: string;
  cs_id: string;
  first_name: string;
  last_name: string | null;
  closing_date: string;
  lead_date: string;
}

interface CsRow {
  id: string;
  full_name: string;
}

interface LeadReportOption {
  id: string;
  report_date: string;
  cold: number;
  consultation: number;
  offering: number;
}

const PREVIOUS_STAGES = ["cold", "consultation", "offering"] as const;

type Tab = "unlinked" | "missing";

/** F-11 Reconciliation. "Laporan gagal validasi" tab omitted: the system
 * has no persisted invalid-report state — validation rejects at write
 * time (Zod + DB constraints), so there's nothing to reconcile after. */
export default function ReconciliationPage() {
  const [tab, setTab] = useState<Tab>("unlinked");
  const [unlinked, setUnlinked] = useState<UnlinkedClosing[]>([]);
  const [missingCs, setMissingCs] = useState<CsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [linkTarget, setLinkTarget] = useState<string | null>(null);
  const [reportOptions, setReportOptions] = useState<LeadReportOption[]>([]);
  const [selectedReport, setSelectedReport] = useState("");
  const [selectedStage, setSelectedStage] = useState<(typeof PREVIOUS_STAGES)[number]>("offering");
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    Promise.all([
      apiFetch<UnlinkedClosing[]>("/api/closings/unlinked"),
      apiFetch<{ id: string; cs_id: string }[]>(`/api/lead-reports?date=${todayJakarta()}`),
      apiFetch<{ cs_id: string; cs_name: string }[]>("/api/dashboard/cs-performance").then((rows) =>
        rows.map((r) => ({ id: r.cs_id, full_name: r.cs_name })),
      ),
    ])
      .then(([unlinkedData, reportsToday, allCs]) => {
        setUnlinked(unlinkedData);
        const reportedCsIds = new Set(reportsToday.map((r) => r.cs_id));
        setMissingCs(allCs.filter((cs) => !reportedCsIds.has(cs.id)));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat"))
      .finally(() => setLoading(false));
  }, []);

  function openLink(c: UnlinkedClosing) {
    setLinkTarget(c.id);
    setSelectedReport("");
    setSelectedStage("offering");
    apiFetch<LeadReportOption[]>(`/api/lead-reports?cs=${c.cs_id}&date=${c.lead_date}`)
      .then(setReportOptions)
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat laporan"));
  }

  async function confirmLink(closingId: string) {
    if (!selectedReport) return;
    setLinking(true);
    setError(null);
    try {
      await apiFetch(`/api/closings/${closingId}/link`, {
        method: "POST",
        body: JSON.stringify({ lead_report_id: selectedReport, previous_stage: selectedStage }),
      });
      setUnlinked((prev) => prev.filter((c) => c.id !== closingId));
      setLinkTarget(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menautkan closing");
    } finally {
      setLinking(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-bold text-ink-900">Reconciliation</h1>
      {error && <Banner variant="danger">{error}</Banner>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab("unlinked")}
          className={tab === "unlinked" ? "rounded-full bg-navy-900 px-3 py-1.5 text-sm text-text-light" : "rounded-full border border-line px-3 py-1.5 text-sm text-ink-600"}
        >
          Unlinked Closings ({unlinked.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("missing")}
          className={tab === "missing" ? "rounded-full bg-navy-900 px-3 py-1.5 text-sm text-text-light" : "rounded-full border border-line px-3 py-1.5 text-sm text-ink-600"}
        >
          CS belum lapor hari ini ({missingCs.length})
        </button>
      </div>

      {loading && <p className="text-sm text-ink-400">Memuat...</p>}

      {tab === "unlinked" && (
        <div className="divide-y divide-line rounded-[10px] border border-line bg-card">
          {unlinked.length === 0 && !loading && (
            <p className="p-4 text-sm text-ink-400">Tidak ada closing yang belum tertaut laporan.</p>
          )}
          {unlinked.map((c) => (
            <div key={c.id} className="p-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-ink-900">
                    {c.first_name} {c.last_name}
                  </p>
                  <p className="text-xs text-ink-400">
                    Lead {formatDateID(c.lead_date)} · Closing {formatDateID(c.closing_date)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => (linkTarget === c.id ? setLinkTarget(null) : openLink(c))}
                  className="h-9 shrink-0 rounded-lg border border-line px-3 text-sm font-medium text-ink-900"
                >
                  Tautkan
                </button>
              </div>

              {linkTarget === c.id && (
                <div className="mt-3 space-y-2 rounded-lg border border-dashed border-line p-3">
                  <select
                    value={selectedReport}
                    onChange={(e) => setSelectedReport(e.target.value)}
                    className="h-9 w-full rounded-lg border border-line px-2 text-sm"
                  >
                    <option value="">Pilih laporan tujuan…</option>
                    {reportOptions.map((r) => (
                      <option key={r.id} value={r.id}>
                        {formatDateID(r.report_date)} — cold {r.cold} / consult {r.consultation} / offer {r.offering}
                      </option>
                    ))}
                  </select>
                  <select
                    value={selectedStage}
                    onChange={(e) => setSelectedStage(e.target.value as (typeof PREVIOUS_STAGES)[number])}
                    className="h-9 w-full rounded-lg border border-line px-2 text-sm"
                  >
                    {PREVIOUS_STAGES.map((s) => (
                      <option key={s} value={s}>
                        Bucket asal: {s}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => confirmLink(c.id)}
                    disabled={!selectedReport || linking}
                    className="h-9 w-full rounded-lg bg-brass text-sm font-semibold text-on-brass disabled:opacity-50"
                  >
                    {linking ? "Menautkan..." : "Konfirmasi tautkan"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "missing" && (
        <div className="divide-y divide-line rounded-[10px] border border-line bg-card">
          {missingCs.length === 0 && !loading && (
            <p className="p-4 text-sm text-ink-400">Semua CS sudah lapor hari ini.</p>
          )}
          {missingCs.map((cs) => (
            <div key={cs.id} className="p-4 text-sm font-medium text-ink-900">
              {cs.full_name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
