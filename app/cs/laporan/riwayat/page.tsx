"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api/client";
import { formatDateID, parseDateID, todayJakarta } from "@/lib/utils/date";

interface LeadReport {
  id: string;
  report_date: string;
  total_lead: number;
}

interface PeriodLock {
  year: number;
  month: number;
}

interface DayRow {
  date: string;
  total_lead: number;
  ids: string[];
  locked: boolean;
}

/** F-15 Riwayat laporan CS — daftar per hari dengan status Tersimpan/Terkunci.
 *  Status dihitung dari period_locks (tak butuh field baru di lead-reports):
 *  laporan yang bulannya terkunci = "Terkunci", sisanya "Tersimpan". */
export default function RiwayatLaporanPage() {
  const [rows, setRows] = useState<DayRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const to = todayJakarta();
    const fromDate = parseDateID(to);
    fromDate.setDate(fromDate.getDate() - 60);
    const from = `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, "0")}-${String(
      fromDate.getDate(),
    ).padStart(2, "0")}`;

    Promise.all([
      apiFetch<LeadReport[]>(`/api/lead-reports?from=${from}&to=${to}`),
      apiFetch<PeriodLock[]>("/api/period-locks"),
    ])
      .then(([reports, locks]) => {
        const lockedMonths = new Set(locks.map((l) => `${l.year}-${l.month}`));
        const byDate = new Map<string, DayRow>();
        for (const r of reports) {
          const d = parseDateID(r.report_date);
          const locked = lockedMonths.has(`${d.getFullYear()}-${d.getMonth() + 1}`);
          const existing = byDate.get(r.report_date);
          if (existing) {
            existing.total_lead += r.total_lead;
            existing.ids.push(r.id);
          } else {
            byDate.set(r.report_date, {
              date: r.report_date,
              total_lead: r.total_lead,
              ids: [r.id],
              locked,
            });
          }
        }
        setRows([...byDate.values()].sort((a, b) => (a.date < b.date ? 1 : -1)));
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <header className="flex items-center gap-2 bg-navy-900 px-[18px] py-4">
        <Link href="/cs" aria-label="Kembali" className="text-[22px] leading-none text-on-dark-muted">
          ‹
        </Link>
        <h1 className="font-display text-lg font-bold text-white">Riwayat laporan</h1>
      </header>

      <div className="space-y-3 p-4">
        {loading && <p className="text-sm text-ink-400">Memuat...</p>}
        {!loading && rows.length === 0 && (
          <p className="text-sm text-ink-400">Belum ada laporan dalam 60 hari terakhir.</p>
        )}

        {rows.map((row) => {
          const card = (
            <div className="flex items-center justify-between rounded-[10px] border border-line bg-card p-4">
              <div>
                <p className="text-[15px] font-medium text-ink-900">{formatDateID(row.date)}</p>
                <p className="mt-0.5 font-mono text-[13px] text-ink-600">{row.total_lead} lead</p>
              </div>
              {row.locked ? (
                <span className="flex items-center gap-1.5 text-[13px] text-ink-400">
                  <span aria-hidden>⛌</span> Terkunci
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-[13px] text-ok">
                  <span aria-hidden>○</span> Tersimpan
                </span>
              )}
            </div>
          );
          // Hanya laporan yang belum terkunci dan tepat satu baris/hari yang bisa
          // dibuka untuk koreksi (sama seperti aturan #10 di beranda).
          return row.locked || row.ids.length !== 1 ? (
            <div key={row.date}>{card}</div>
          ) : (
            <Link key={row.date} href={`/cs/laporan?id=${row.ids[0]}`}>
              {card}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
