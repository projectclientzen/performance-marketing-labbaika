"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import { formatPercent } from "@/lib/utils/percent";
import { formatRupiah } from "@/lib/utils/rupiah";
import { todayJakarta } from "@/lib/utils/date";
import { Banner } from "@/components/ui/Banner";

interface InsightRow {
  category_id: string;
  category_name: string;
  lead_count: number;
  pct_of_filled: number | null;
  pct_of_total_lead: number | null;
}

interface ChannelRow {
  source_id: string | null;
  source_name: string;
  closing: number;
  omset: number;
}

/** F-10 Lead Intelligence: Top Reason Not Closing, denominator eksplisit. */
export default function LeadIntelligencePage() {
  const [rows, setRows] = useState<InsightRow[]>([]);
  const [channels, setChannels] = useState<ChannelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const from = `${todayJakarta().slice(0, 7)}-01`;
    const to = todayJakarta();
    Promise.all([
      apiFetch<InsightRow[]>(`/api/dashboard/insights?from=${from}&to=${to}`),
      apiFetch<ChannelRow[]>(`/api/dashboard/closings-by-channel?from=${from}&to=${to}`),
    ])
      .then(([ins, ch]) => {
        setRows(ins);
        setChannels(ch);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat"))
      .finally(() => setLoading(false));
  }, []);

  const maxCount = Math.max(1, ...rows.map((r) => r.lead_count));
  const totalFilled = rows.reduce((s, r) => s + r.lead_count, 0);
  const maxChannel = Math.max(1, ...channels.map((c) => c.closing));

  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-bold text-ink-900">Lead Intelligence</h1>
      {error && <Banner variant="danger">{error}</Banner>}
      {loading && <p className="text-sm text-ink-400">Memuat...</p>}

      {!loading && rows.length === 0 && (
        <p className="text-sm text-ink-400">Belum ada insight yang diberi CS untuk periode ini.</p>
      )}

      <div className="space-y-3 rounded-[10px] border border-line bg-card p-4">
        <h2 className="text-sm font-semibold text-ink-600">Top Reason Not Closing</h2>
        {rows.map((r) => (
          <div key={r.category_id}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-ink-600">{r.category_name}</span>
              <span className="font-mono text-ink-600">
                {formatPercent(r.pct_of_filled)} ({formatPercent(r.pct_of_total_lead)} dari total lead)
              </span>
            </div>
            {/* Bar diukur dari prototype F-10: tinggi 30px, radius 6px, track
                paper, isi biru (stage-consult) — bukan brass/8px. */}
            <div className="h-[30px] w-full overflow-hidden rounded-md bg-paper">
              <div
                className="h-full rounded-md bg-blue"
                style={{ width: `${(r.lead_count / maxCount) * 100}%` }}
              />
            </div>
          </div>
        ))}
        {rows.length > 0 && (
          <p className="pt-2 text-xs text-ink-400">
            Persentase dihitung dari {totalFilled} lead yang diberi insight, bukan total lead periode ini.
          </p>
        )}
      </div>

      {/* Closing per channel — SEMUA source termasuk organik/"other". Sengaja
          terpisah dari metrik iklan (Overview/Campaign): ini untuk melihat
          channel non-iklan yang sudah menghasilkan closing, kandidat untuk
          diserang iklan. Tidak ikut memengaruhi ROI/CPP iklan. */}
      <div className="space-y-3 rounded-[10px] border border-line bg-card p-4">
        <div>
          <h2 className="text-sm font-semibold text-ink-600">Closing per channel</h2>
          <p className="mt-0.5 text-xs text-ink-400">
            Semua source (termasuk organik). Terpisah dari metrik iklan — bahan melihat channel
            mana yang potensial untuk diiklankan.
          </p>
        </div>
        {!loading && channels.length === 0 && (
          <p className="text-sm text-ink-400">Belum ada closing untuk periode ini.</p>
        )}
        {channels.map((c) => (
          <div key={c.source_id ?? "other"}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-ink-900">{c.source_name}</span>
              <span className="font-mono text-ink-600">
                {c.closing} closing · {formatRupiah(c.omset)}
              </span>
            </div>
            <div className="h-[30px] w-full overflow-hidden rounded-md bg-paper">
              <div
                className="h-full rounded-md bg-stage-closing"
                style={{ width: `${(c.closing / maxChannel) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
