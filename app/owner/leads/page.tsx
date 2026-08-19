"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import { formatPercent } from "@/lib/utils/percent";
import { todayJakarta } from "@/lib/utils/date";
import { Banner } from "@/components/ui/Banner";

interface InsightRow {
  category_id: string;
  category_name: string;
  lead_count: number;
  pct_of_filled: number | null;
  pct_of_total_lead: number | null;
}

/** F-10 Lead Intelligence: Top Reason Not Closing, denominator eksplisit. */
export default function LeadIntelligencePage() {
  const [rows, setRows] = useState<InsightRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const from = `${todayJakarta().slice(0, 7)}-01`;
    const to = todayJakarta();
    apiFetch<InsightRow[]>(`/api/dashboard/insights?from=${from}&to=${to}`)
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat"))
      .finally(() => setLoading(false));
  }, []);

  const maxCount = Math.max(1, ...rows.map((r) => r.lead_count));
  const totalFilled = rows.reduce((s, r) => s + r.lead_count, 0);

  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-bold text-ink-900">Lead Intelligence</h1>
      {error && <Banner variant="danger">{error}</Banner>}
      {loading && <p className="text-sm text-ink-400">Memuat...</p>}

      {!loading && rows.length === 0 && (
        <p className="text-sm text-ink-400">Belum ada insight yang diberi CS untuk periode ini.</p>
      )}

      <div className="space-y-3 rounded-[10px] border border-line bg-card p-4">
        <h2 className="text-sm font-semibold text-ink-600">Top Reason Not Closing</h2>
        {rows.map((r) => (
          <div key={r.category_id}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-ink-900">{r.category_name}</span>
              <span className="font-mono text-ink-600">
                {formatPercent(r.pct_of_filled)} ({formatPercent(r.pct_of_total_lead)} dari total lead)
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-brass"
                style={{ width: `${(r.lead_count / maxCount) * 100}%` }}
              />
            </div>
          </div>
        ))}
        {rows.length > 0 && (
          <p className="pt-2 text-xs text-ink-400">
            Persentase dihitung dari {totalFilled} lead yang diberi insight, bukan total lead periode ini.
          </p>
        )}
      </div>
    </div>
  );
}
