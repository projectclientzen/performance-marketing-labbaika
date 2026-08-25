"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import { MetricCard } from "@/components/ui/MetricCard";
import { monthKey, monthRange, todayJakarta } from "@/lib/utils/date";

interface LeadReport {
  report_date: string;
  total_lead: number;
  closing: number;
}

export default function CsPerformaPage() {
  const [reports, setReports] = useState<LeadReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = todayJakarta();
    const [year, month] = monthKey(today).split("-").map(Number);
    const { from, to } = monthRange(year, month);
    apiFetch<LeadReport[]>(`/api/lead-reports?from=${from}&to=${to}`)
      .then(setReports)
      .finally(() => setLoading(false));
  }, []);

  const totalLead = reports.reduce((sum, r) => sum + r.total_lead, 0);
  const totalClosing = reports.reduce((sum, r) => sum + r.closing, 0);
  const closingRate = totalLead > 0 ? `${((totalClosing / totalLead) * 100).toFixed(1)}%` : "-";
  // A cs can have multiple report rows for the same day (one per lead
  // source), so reports.length overcounts "days reported".
  const reportDays = new Set(reports.map((r) => r.report_date)).size;

  return (
    <div>
      {/* Struktur prototype F-09 "Performa saya": title bar navy + hero navy +
          grid tile. Hero memakai Closing rate (metrik nyata), BUKAN ROI-per-CS
          yang dibatalkan Maszen (§25) — spend hanya per-campaign, tak bisa
          diatribusikan per-CS. */}
      <header className="bg-navy-900 px-[18px] py-4">
        <h1 className="font-display text-lg font-bold text-white">Performa saya</h1>
      </header>

      <div className="space-y-3 p-4">
        <div className="rounded-xl bg-navy-900 p-[18px]">
          <p className="text-xs text-on-dark-muted">Closing rate kamu bulan ini</p>
          <p className="mt-1 font-display text-[34px] font-semibold leading-none text-brass">
            {loading ? "…" : closingRate}
          </p>
          <p className="mt-2 text-xs text-on-dark-muted">
            {loading ? "" : `${totalClosing} closing dari ${totalLead} lead`}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <MetricCard label="Hari lapor" value={String(reportDays)} loading={loading} />
          <MetricCard label="Total closing" value={String(totalClosing)} loading={loading} />
        </div>
      </div>
    </div>
  );
}
