"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import { formatDateID, todayJakarta } from "@/lib/utils/date";
import { StageRail } from "@/components/ui/StageRail";
import { Banner } from "@/components/ui/Banner";

interface LeadReport {
  id: string;
  report_date: string;
  cs_id: string;
  total_lead: number;
  cold: number;
  consultation: number;
  offering: number;
  closing: number;
}

interface PeriodLock {
  year: number;
  month: number;
}

export default function RiwayatLaporanPage() {
  const [reports, setReports] = useState<LeadReport[]>([]);
  const [csNames, setCsNames] = useState<Record<string, string>>({});
  const [lockedPeriods, setLockedPeriods] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = todayJakarta();
    const from = `${today.slice(0, 7)}-01`;
    Promise.all([
      apiFetch<LeadReport[]>(`/api/lead-reports?from=${from}&to=${today}`),
      apiFetch<{ cs_id: string; cs_name: string }[]>("/api/dashboard/cs-performance"),
      apiFetch<PeriodLock[]>("/api/period-locks"),
    ])
      .then(([reportData, csData, locks]) => {
        setReports(reportData);
        setCsNames(Object.fromEntries(csData.map((c) => [c.cs_id, c.cs_name])));
        setLockedPeriods(new Set(locks.map((l) => `${l.year}-${String(l.month).padStart(2, "0")}`)));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-bold text-ink-900">Riwayat laporan CS</h1>
      {error && <Banner variant="danger">{error}</Banner>}
      {loading && <p className="text-sm text-ink-400">Memuat...</p>}

      <div className="divide-y divide-line rounded-[10px] border border-line bg-card">
        {reports.map((r) => {
          const locked = lockedPeriods.has(r.report_date.slice(0, 7));
          return (
            <div key={r.id} className="flex items-center gap-4 p-3">
              <div className="w-28 shrink-0 text-sm">
                <p className="font-medium text-ink-900">{formatDateID(r.report_date)}</p>
                <p className="text-xs text-ink-400">{csNames[r.cs_id] ?? r.cs_id}</p>
              </div>
              <div className="flex-1">
                <StageRail
                  size="mini"
                  segments={[
                    { stage: "cold", value: r.cold },
                    { stage: "consultation", value: r.consultation },
                    { stage: "offering", value: r.offering },
                    { stage: "closing", value: r.closing },
                  ]}
                />
              </div>
              <span className="font-mono text-sm text-ink-900">{r.total_lead}</span>
              <span
                className={`shrink-0 text-xs ${locked ? "text-ink-400" : "text-ok"}`}
                title={locked ? "Terkunci" : "Tersimpan"}
              >
                {locked ? "⛌ Terkunci" : "○ Tersimpan"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
