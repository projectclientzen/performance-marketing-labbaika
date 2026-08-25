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
    <div>
      <header className="bg-navy-900 px-[22px] pb-[18px] pt-4 text-white">
        <p className="text-[13px] text-on-dark-muted">{formatDateLong(today)}</p>
        <h1 className="mt-0.5 font-display text-2xl font-bold tracking-tight">
          Assalamualaikum, {loading ? "…" : (me?.full_name ?? "CS")}
        </h1>
      </header>

      <div className="space-y-4 p-[18px]">
        <div
          className={
            hasReportedToday
              ? "rounded-[10px] border border-ok/30 bg-ok/10 p-[18px]"
              : "rounded-[10px] border border-brass/40 bg-brass-lo p-[18px]"
          }
        >
          {hasReportedToday ? (
            <p className="text-sm font-medium text-ink-900">Laporan hari ini sudah dikirim ✓</p>
          ) : (
            <>
              <div className="flex items-center gap-2 text-[13px] font-medium text-warn-ink">
                <span className="h-2 w-2 rounded-full bg-warn" />
                Belum lapor hari ini
              </div>
              <Link
                href="/cs/laporan"
                className="mt-3.5 flex h-[52px] w-full items-center justify-center rounded-lg bg-brass text-base font-semibold text-on-brass"
              >
                Isi laporan hari ini
              </Link>
              <p className="mt-2 text-center text-xs text-warn-ink">sekitar 1 menit</p>
            </>
          )}
        </div>

        <Link
          href="/cs/closing"
          className="flex h-[46px] w-full items-center justify-center rounded-lg border border-line bg-card text-[15px] font-medium text-ink-900"
        >
          Catat closing
        </Link>

        <section className="rounded-[10px] border border-line bg-card p-4">
          <h2 className="mb-3.5 text-[13px] font-medium text-ink-600">7 hari terakhir</h2>
          <div className="space-y-3.5">
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
            const row = (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between">
                  <span className="text-[13px] text-ink-900">{formatDateID(day)}</span>
                  <span className="font-mono text-[13px] text-ink-600">{totals.total_lead} lead</span>
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
            // 10-AUDIT-FE-BE.md #10: a day is only editable when it has
            // exactly one report row — with more than one (multiple lead
            // sources reported the same day), there's no single row for
            // PATCH /api/lead-reports/:id to target, so it isn't wrapped
            // in a link rather than guessing which one.
            return dayReports.length === 1 ? (
              <Link key={day} href={`/cs/laporan?id=${dayReports[0].id}`}>
                {row}
              </Link>
            ) : (
              <div key={day}>{row}</div>
            );
          })}
          </div>
        </section>
      </div>
    </div>
  );
}
