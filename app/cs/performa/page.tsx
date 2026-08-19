"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import { MetricCard } from "@/components/ui/MetricCard";
import { monthKey, todayJakarta } from "@/lib/utils/date";

interface LeadReport {
  report_date: string;
  total_lead: number;
  closing: number;
}

export default function CsPerformaPage() {
  const [reports, setReports] = useState<LeadReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const month = monthKey(todayJakarta());
    apiFetch<LeadReport[]>(`/api/lead-reports?from=${month}-01&to=${month}-31`)
      .then(setReports)
      .finally(() => setLoading(false));
  }, []);

  const totalLead = reports.reduce((sum, r) => sum + r.total_lead, 0);
  const totalClosing = reports.reduce((sum, r) => sum + r.closing, 0);
  const closingRate = totalLead > 0 ? `${((totalClosing / totalLead) * 100).toFixed(1)}%` : "-";

  return (
    <div className="space-y-5">
      <h1 className="font-display text-xl font-bold text-ink-900">Performa saya</h1>
      <div className="grid grid-cols-2 gap-3">
        <MetricCard label="Total lead bulan ini" value={String(totalLead)} loading={loading} />
        <MetricCard label="Total closing" value={String(totalClosing)} loading={loading} />
        <MetricCard label="Closing rate" value={closingRate} variant="accent" loading={loading} />
        <MetricCard label="Hari lapor" value={String(reports.length)} loading={loading} />
      </div>
    </div>
  );
}
