"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import { formatDateID, todayJakarta } from "@/lib/utils/date";
import { Banner } from "@/components/ui/Banner";

interface UnlinkedClosing {
  id: string;
  first_name: string;
  last_name: string | null;
  closing_date: string;
  lead_date: string;
}

interface CsRow {
  id: string;
  full_name: string;
}

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
              <p className="font-medium text-ink-900">
                {c.first_name} {c.last_name}
              </p>
              <p className="text-xs text-ink-400">
                Lead {formatDateID(c.lead_date)} · Closing {formatDateID(c.closing_date)}
              </p>
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
