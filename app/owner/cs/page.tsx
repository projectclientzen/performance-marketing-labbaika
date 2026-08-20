"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import { formatRupiah } from "@/lib/utils/rupiah";
import { formatPercent } from "@/lib/utils/percent";
import { todayJakarta } from "@/lib/utils/date";
import { Banner } from "@/components/ui/Banner";

interface CsRow {
  cs_id: string;
  cs_name: string;
  total_lead: number;
  cold: number;
  consultation: number;
  offering: number;
  closing: number;
  gross_booking_value: number;
  avg_closing_interval: number | null;
  median_closing_interval: number | null;
  cancellation_rate: number | null;
  report_days: number;
}

export default function CsPerformancePage() {
  const [rows, setRows] = useState<CsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const from = `${todayJakarta().slice(0, 7)}-01`;
    const to = todayJakarta();
    apiFetch<CsRow[]>(`/api/dashboard/cs-performance?from=${from}&to=${to}`)
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-bold text-ink-900">CS Performance</h1>
      {error && <Banner variant="danger">{error}</Banner>}
      {loading && <p className="text-sm text-ink-400">Memuat...</p>}

      <div className="overflow-x-auto rounded-[10px] border border-line bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink-600">
              <th className="p-3">CS</th>
              <th className="p-3 text-right">Total Lead</th>
              <th className="p-3 text-right">Closing</th>
              <th className="p-3 text-right">Omset</th>
              <th className="p-3 text-right">Avg Interval</th>
              <th className="p-3 text-right">Cancellation Rate</th>
              <th className="p-3 text-right">Hari Lapor</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {rows.map((r) => (
              <tr key={r.cs_id} className="border-b border-line last:border-0">
                <td className="p-3 font-sans font-medium text-ink-900">{r.cs_name}</td>
                <td className="p-3 text-right">{r.total_lead}</td>
                <td className="p-3 text-right">{r.closing}</td>
                <td className="p-3 text-right font-semibold text-brass">{formatRupiah(r.gross_booking_value)}</td>
                <td className="p-3 text-right">
                  {r.avg_closing_interval != null ? `${Math.round(r.avg_closing_interval)} hari` : "-"}
                </td>
                <td className="p-3 text-right">{formatPercent(r.cancellation_rate)}</td>
                <td className="p-3 text-right">{r.report_days}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
