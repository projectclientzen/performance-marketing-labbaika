"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import { formatRupiah } from "@/lib/utils/rupiah";
import { formatPercent, formatROI, formatMultiple } from "@/lib/utils/percent";
import { todayJakarta } from "@/lib/utils/date";
import { Banner } from "@/components/ui/Banner";

interface CampaignRow {
  campaign_id: string;
  campaign_name: string;
  spend: number;
  total_lead: number;
  cpl_meta: number | null;
  reached_consultation: number;
  reached_offering: number;
  closing: number;
  closing_rate: number | null;
  gross_booking_value: number;
  cpp: number | null;
  breakeven_cpp: number | null;
  roi: number | null;
  roas: number | null;
}

export default function CampaignQualityPage() {
  const [rows, setRows] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const from = `${todayJakarta().slice(0, 7)}-01`;
    const to = todayJakarta();
    apiFetch<CampaignRow[]>(`/api/dashboard/campaigns?from=${from}&to=${to}&attribution=cohort`)
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-bold text-ink-900">Campaign Quality</h1>
      {error && <Banner variant="danger">{error}</Banner>}
      {loading && <p className="text-sm text-ink-400">Memuat...</p>}

      <div className="overflow-x-auto rounded-[10px] border border-line bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink-600">
              <th className="p-3">Campaign</th>
              <th className="p-3 text-right">Spend</th>
              <th className="p-3 text-right">Lead</th>
              <th className="p-3 text-right">CPL</th>
              <th className="p-3 text-right">Closing</th>
              <th className="p-3 text-right">Closing Rate</th>
              <th className="p-3 text-right">Omset</th>
              <th className="p-3 text-right">CPP</th>
              <th className="p-3 text-right">Break-even CPP</th>
              <th className="p-3 text-right">ROI</th>
              <th className="p-3 text-right">ROAS</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {rows.map((r) => (
              <tr key={r.campaign_id} className="border-b border-line last:border-0">
                <td className="p-3 font-sans font-medium text-ink-900">{r.campaign_name}</td>
                <td className="p-3 text-right">{formatRupiah(r.spend)}</td>
                <td className="p-3 text-right">{r.total_lead}</td>
                <td className="p-3 text-right">{r.cpl_meta ? formatRupiah(Math.round(r.cpl_meta)) : "-"}</td>
                <td className="p-3 text-right">{r.closing}</td>
                <td className="p-3 text-right">{formatPercent(r.closing_rate)}</td>
                <td className="p-3 text-right">{formatRupiah(r.gross_booking_value)}</td>
                <td className="p-3 text-right">{r.cpp ? formatRupiah(Math.round(r.cpp)) : "-"}</td>
                <td className="p-3 text-right">{r.breakeven_cpp ? formatRupiah(Math.round(r.breakeven_cpp)) : "-"}</td>
                <td className="p-3 text-right font-semibold text-brass">{formatROI(r.roi)}</td>
                <td className="p-3 text-right">{formatMultiple(r.roas)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
