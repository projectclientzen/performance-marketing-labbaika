"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import { formatDateID, todayJakarta } from "@/lib/utils/date";
import { Banner } from "@/components/ui/Banner";
import { StageRail } from "@/components/ui/StageRail";

interface LeadReport {
  cs_id: string;
  report_date: string;
  total_lead: number;
  cold: number;
  consultation: number;
  offering: number;
  closing: number;
}

interface UserRow {
  id: string;
  full_name: string;
}

interface Row {
  cs_id: string;
  name: string;
  cold: number;
  hot: number;
  prospek: number;
  closing: number;
  total: number;
}

/**
 * REKAP — rekap lead harian per CS, plus baris rata-rata.
 *
 * Nama kolom memakai istilah yang dipakai CS sehari-hari, bukan nama kolom
 * database. Pemetaannya sudah ditetapkan di 02-PRD-v1.3.md §64-66:
 *
 *   cold         → "Cold"    (belum merespons)
 *   consultation → "Hot"     (aktif berkonsultasi)
 *   offering     → "Prospek" (sudah masuk tahap penawaran)
 *
 * Closing ikut ditampilkan supaya totalnya utuh — PRD §71:
 * cold + consultation + offering + closing = total_lead.
 */
export default function RekapPage() {
  const [date, setDate] = useState(todayJakarta());
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      apiFetch<LeadReport[]>(`/api/lead-reports?date=${date}`),
      apiFetch<UserRow[]>("/api/users"),
    ])
      .then(([reports, users]) => {
        const nameById = new Map(users.map((u) => [u.id, u.full_name]));
        const byCs = new Map<string, Row>();
        for (const r of reports) {
          // Satu CS bisa punya beberapa baris per hari (satu per source),
          // jadi angkanya dijumlahkan dulu sebelum ditampilkan.
          const target = byCs.get(r.cs_id) ?? {
            cs_id: r.cs_id,
            name: nameById.get(r.cs_id) ?? "CS",
            cold: 0,
            hot: 0,
            prospek: 0,
            closing: 0,
            total: 0,
          };
          target.cold += r.cold;
          target.hot += r.consultation;
          target.prospek += r.offering;
          target.closing += r.closing;
          target.total += r.total_lead;
          byCs.set(r.cs_id, target);
        }
        setRows([...byCs.values()].sort((a, b) => b.total - a.total));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat rekap"))
      .finally(() => setLoading(false));
  }, [date]);

  const avg =
    rows.length > 0
      ? {
          cold: Math.round(rows.reduce((s, r) => s + r.cold, 0) / rows.length),
          hot: Math.round(rows.reduce((s, r) => s + r.hot, 0) / rows.length),
          prospek: Math.round(rows.reduce((s, r) => s + r.prospek, 0) / rows.length),
          closing: Math.round(rows.reduce((s, r) => s + r.closing, 0) / rows.length),
          total: Math.round(rows.reduce((s, r) => s + r.total, 0) / rows.length),
        }
      : null;

  const legend = [
    { label: "Cold", cls: "bg-stage-cold" },
    { label: "Hot", cls: "bg-stage-consult" },
    { label: "Prospek", cls: "bg-stage-offer" },
    { label: "Closing", cls: "bg-stage-closing" },
  ];

  function rail(r: { cold: number; hot: number; prospek: number; closing: number }) {
    return (
      <StageRail
        size="medium"
        segments={[
          { stage: "cold", value: r.cold },
          { stage: "consultation", value: r.hot },
          { stage: "offering", value: r.prospek },
          { stage: "closing", value: r.closing },
        ]}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-xl font-bold text-ink-900">Rekap lead harian</h1>
        <input
          type="date"
          value={date}
          max={todayJakarta()}
          onChange={(e) => setDate(e.target.value)}
          className="h-10 rounded-lg border border-line px-2 text-sm text-ink-900"
        />
      </div>

      {error && <Banner variant="danger">{error}</Banner>}
      {loading && <p className="text-sm text-ink-400">Memuat...</p>}

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-ink-600">
        {legend.map((l) => (
          <span key={l.label} className="inline-flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${l.cls}`} />
            {l.label}
          </span>
        ))}
      </div>

      {!loading && rows.length === 0 && (
        <p className="text-sm text-ink-400">Belum ada laporan untuk {formatDateID(date)}.</p>
      )}

      {rows.length > 0 && (
        <>
          <div className="hidden overflow-x-auto rounded-[10px] border border-line bg-card md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-600">
                  <th className="p-3">CS</th>
                  <th className="p-3 text-right">Cold</th>
                  <th className="p-3 text-right">Hot</th>
                  <th className="p-3 text-right">Prospek</th>
                  <th className="p-3 text-right">Closing</th>
                  <th className="p-3 text-right">Total</th>
                  <th className="w-[220px] p-3">Komposisi</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {rows.map((r) => (
                  <tr key={r.cs_id} className="border-b border-line last:border-0">
                    <td className="p-3 font-sans font-medium text-ink-900">{r.name}</td>
                    <td className="p-3 text-right">{r.cold}</td>
                    <td className="p-3 text-right">{r.hot}</td>
                    <td className="p-3 text-right">{r.prospek}</td>
                    <td className="p-3 text-right">{r.closing}</td>
                    <td className="p-3 text-right font-semibold">{r.total}</td>
                    <td className="p-3">{rail(r)}</td>
                  </tr>
                ))}
                {avg && (
                  <tr className="bg-paper">
                    <td className="p-3 font-sans font-medium text-ink-600">Rata-rata semua CS</td>
                    <td className="p-3 text-right">{avg.cold}</td>
                    <td className="p-3 text-right">{avg.hot}</td>
                    <td className="p-3 text-right">{avg.prospek}</td>
                    <td className="p-3 text-right">{avg.closing}</td>
                    <td className="p-3 text-right font-semibold">{avg.total}</td>
                    <td className="p-3">{rail(avg)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {rows.map((r) => (
              <div key={r.cs_id} className="rounded-[10px] border border-line bg-card p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-medium text-ink-900">{r.name}</span>
                  <span className="font-mono font-semibold text-brass">{r.total}</span>
                </div>
                {rail(r)}
                <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[13px] text-ink-600">
                  <span>Cold {r.cold}</span>
                  <span>Hot {r.hot}</span>
                  <span>Prospek {r.prospek}</span>
                  <span>Closing {r.closing}</span>
                </div>
              </div>
            ))}
            {avg && (
              <div className="rounded-[10px] border border-line bg-paper p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-medium text-ink-600">Rata-rata semua CS</span>
                  <span className="font-mono font-semibold text-ink-900">{avg.total}</span>
                </div>
                {rail(avg)}
                <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[13px] text-ink-600">
                  <span>Cold {avg.cold}</span>
                  <span>Hot {avg.hot}</span>
                  <span>Prospek {avg.prospek}</span>
                  <span>Closing {avg.closing}</span>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
