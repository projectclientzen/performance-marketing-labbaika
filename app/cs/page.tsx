"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api/client";
import { formatDateLong, formatDateID, todayJakarta } from "@/lib/utils/date";
import { StageRail } from "@/components/ui/StageRail";

interface Me {
  full_name: string;
}

interface LeadReport {
  id: string;
  report_date: string;
  total_lead: number;
  cold: number;
  consultation: number;
  offering: number;
  closing: number;
}

function last7Days(): string[] {
  const days: string[] = [];
  const today = todayJakarta();
  const [y, m, d] = today.split("-").map(Number);
  for (let i = 0; i < 7; i++) {
    const date = new Date(y, m - 1, d - i);
    days.push(
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
    );
  }
  return days;
}

export default function CsHomePage() {
  const [me, setMe] = useState<Me | null>(null);
  const [reports, setReports] = useState<LeadReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const days = last7Days();
    Promise.all([
      apiFetch<Me>("/api/me"),
      apiFetch<LeadReport[]>(`/api/lead-reports?from=${days[6]}&to=${days[0]}`),
    ])
      .then(([meData, reportData]) => {
        setMe(meData);
        setReports(reportData);
      })
      .finally(() => setLoading(false));
  }, []);

  const today = todayJakarta();
  const days = last7Days();
  const todaysReports = reports.filter((r) => r.report_date === today);
  const hasReportedToday = todaysReports.length > 0;

  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm text-ink-400">{formatDateLong(today)}</p>
        <h1 className="font-display text-xl font-bold text-ink-900">
          Halo, {loading ? "…" : (me?.full_name ?? "CS")}
        </h1>
      </header>

      <div
        className={
          hasReportedToday
            ? "rounded-[10px] border border-ok/30 bg-ok/10 p-4"
            : "rounded-[10px] border border-brass/40 bg-brass-lo p-4"
        }
      >
        {hasReportedToday ? (
          <p className="text-sm font-medium text-ink-900">Laporan hari ini sudah dikirim ✓</p>
        ) : (
          <>
            <p className="text-sm font-medium text-ink-900">Belum ada laporan hari ini</p>
            <p className="mt-1 text-xs text-ink-600">Isi sekarang, sekitar 1 menit.</p>
            <Link
              href="/cs/laporan"
              className="mt-3 inline-flex h-12 w-full items-center justify-center rounded-lg bg-brass text-base font-semibold text-navy-900"
            >
              Isi laporan hari ini
            </Link>
          </>
        )}
      </div>

      <Link
        href="/cs/closing"
        className="flex h-12 w-full items-center justify-center rounded-lg border border-line bg-card text-base font-semibold text-ink-900"
      >
        Catat closing
      </Link>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-ink-600">7 hari terakhir</h2>
        <div className="space-y-2">
          {days.map((day) => {
            const dayReports = reports.filter((r) => r.report_date === day);
            const totals = dayReports.reduce(
              (acc, r) => ({
                cold: acc.cold + r.cold,
                consultation: acc.consultation + r.consultation,
                offering: acc.offering + r.offering,
                closing: acc.closing + r.closing,
                total_lead: acc.total_lead + r.total_lead,
              }),
              { cold: 0, consultation: 0, offering: 0, closing: 0, total_lead: 0 },
            );
            return (
              <div key={day} className="rounded-[10px] border border-line bg-card p-3">
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="text-ink-600">{formatDateID(day)}</span>
                  <span className="font-mono text-ink-900">{totals.total_lead} lead</span>
                </div>
                <StageRail
                  size="mini"
                  segments={[
                    { stage: "cold", value: totals.cold },
                    { stage: "consultation", value: totals.consultation },
                    { stage: "offering", value: totals.offering },
                    { stage: "closing", value: totals.closing },
                  ]}
                />
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
