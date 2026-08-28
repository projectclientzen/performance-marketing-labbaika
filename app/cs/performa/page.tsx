"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import { MetricCard } from "@/components/ui/MetricCard";
import { LogoutButton } from "@/components/LogoutButton";
import { monthKey, monthRange, todayJakarta } from "@/lib/utils/date";

interface LeadReport {
  report_date: string;
  total_lead: number;
}

interface ClosingRow {
  id: string;
  source_id: string | null;
  payment_status: string;
  cancelled_at: string | null;
}

interface LeadSource {
  id: string;
  name: string;
}

export default function CsPerformaPage() {
  const [reports, setReports] = useState<LeadReport[]>([]);
  const [closings, setClosings] = useState<ClosingRow[]>([]);
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = todayJakarta();
    const [year, month] = monthKey(today).split("-").map(Number);
    const { from, to } = monthRange(year, month);
    Promise.all([
      apiFetch<LeadReport[]>(`/api/lead-reports?from=${from}&to=${to}`),
      // Closing dihitung dari tabel closings, BUKAN dari lead_reports.closing.
      // Closing "other"/organik yang tak tertaut ke laporan harian tetap
      // terhitung di sini (dulu tidak — itu keluhan tim CS).
      apiFetch<ClosingRow[]>(`/api/closings?from=${from}&to=${to}`),
      apiFetch<LeadSource[]>("/api/master/sources"),
    ])
      .then(([r, c, s]) => {
        setReports(r);
        setClosings(c);
        setSources(s);
      })
      .finally(() => setLoading(false));
  }, []);

  const totalLead = reports.reduce((sum, r) => sum + r.total_lead, 0);
  // Closing sukses = belum dibatalkan.
  const valid = closings.filter((c) => !c.cancelled_at && c.payment_status !== "cancelled");
  const totalClosing = valid.length;
  const closingRate = totalLead > 0 ? `${((totalClosing / totalLead) * 100).toFixed(1)}%` : "-";
  // A cs can have multiple report rows for the same day (one per lead source),
  // so reports.length overcounts "days reported".
  const reportDays = new Set(reports.map((r) => r.report_date)).size;

  const sourceName = new Map(sources.map((s) => [s.id, s.name]));
  const perChannel = Object.entries(
    valid.reduce<Record<string, number>>((acc, c) => {
      const key = c.source_id ?? "other";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .map(([id, count]) => ({ name: id === "other" ? "Lainnya" : sourceName.get(id) ?? "Lainnya", count }))
    .sort((a, b) => b.count - a.count);
  const maxChannel = Math.max(1, ...perChannel.map((c) => c.count));

  return (
    <div className="lg:mx-auto lg:max-w-2xl">
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

        {/* Rincian closing per channel/source — termasuk yang "other". */}
        <section className="rounded-[10px] border border-line bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold text-ink-600">Closing per channel</h2>
          {loading ? (
            <p className="text-sm text-ink-400">Memuat...</p>
          ) : perChannel.length === 0 ? (
            <p className="text-sm text-ink-400">Belum ada closing bulan ini.</p>
          ) : (
            <div className="space-y-2.5">
              {perChannel.map((c) => (
                <div key={c.name}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-ink-900">{c.name}</span>
                    <span className="font-mono text-ink-600">{c.count}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-paper">
                    <div
                      className="h-full rounded-full bg-blue"
                      style={{ width: `${(c.count / maxChannel) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="pt-2">
          <LogoutButton className="flex h-11 w-full items-center justify-center rounded-lg border border-line bg-card text-sm font-medium text-danger" />
        </div>
      </div>
    </div>
  );
}
