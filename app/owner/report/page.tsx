"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import { formatRupiah } from "@/lib/utils/rupiah";
import { formatROI } from "@/lib/utils/percent";
import { todayJakarta } from "@/lib/utils/date";
import { MetricCard } from "@/components/ui/MetricCard";
import { Banner } from "@/components/ui/Banner";

interface MonthlyReport {
  period: { year: number; month: number; from: string; to: string };
  overview: {
    spend: number;
    total_lead: number;
    closing: number;
    gross_booking_value: number;
    roi: number | null;
  };
  campaigns: unknown[];
  cs_performance: unknown[];
}

export default function ManagementReportPage() {
  const [year, setYear] = useState(parseInt(todayJakarta().slice(0, 4), 10));
  const [month, setMonth] = useState(parseInt(todayJakarta().slice(5, 7), 10));
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    apiFetch<MonthlyReport>(`/api/reports/monthly?year=${year}&month=${month}`)
      .then(setReport)
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat"))
      .finally(() => setLoading(false));
  }, [year, month]);

  function downloadJson() {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `management-report-${year}-${month}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-bold text-ink-900">Management Report</h1>
        <button
          type="button"
          onClick={downloadJson}
          disabled={!report}
          className="h-10 rounded-lg bg-brass px-4 text-sm font-semibold text-navy-900 disabled:opacity-50"
        >
          Unduh
        </button>
      </div>

      <div className="flex gap-2">
        <select value={month} onChange={(e) => setMonth(parseInt(e.target.value, 10))} className="h-10 rounded-lg border border-line px-2 text-sm">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>
              Bulan {m}
            </option>
          ))}
        </select>
        <input
          type="number"
          value={year}
          onChange={(e) => setYear(parseInt(e.target.value, 10))}
          className="h-10 w-24 rounded-lg border border-line px-2 text-sm"
        />
      </div>

      {error && <Banner variant="danger">{error}</Banner>}
      {loading && <p className="text-sm text-ink-400">Memuat...</p>}

      {report && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <MetricCard label="Spend" value={formatRupiah(report.overview.spend)} />
          <MetricCard label="Lead" value={String(report.overview.total_lead)} />
          <MetricCard label="Closing" value={String(report.overview.closing)} />
          <MetricCard label="Omset" value={formatRupiah(report.overview.gross_booking_value)} />
          <MetricCard label="ROI" value={formatROI(report.overview.roi)} variant="accent" />
        </div>
      )}
    </div>
  );
}
