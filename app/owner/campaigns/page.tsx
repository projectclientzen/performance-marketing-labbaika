"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import { formatRupiah } from "@/lib/utils/rupiah";
import { formatPercent, formatROI, formatMultiple } from "@/lib/utils/percent";
import { todayJakarta } from "@/lib/utils/date";
import { Banner } from "@/components/ui/Banner";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";

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

// →consult/→offer/→close are stage-to-stage conversion, each denominated by
// the previous stage's count (verified against the prototype's own numbers:
// 250 lead, →consult 80% → 200, →offer 50% of 200 → 100, →close 30% of 100
// → 30 closing, which matches the row's closing count exactly).
function pct(n: number, total: number): number | null {
  return total > 0 ? n / total : null;
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

  const columns: DataTableColumn<CampaignRow>[] = [
    { key: "campaign_name", header: "Campaign", accessor: (r) => r.campaign_name },
    {
      key: "spend",
      header: "Spend",
      align: "right",
      sortable: true,
      accessor: (r) => r.spend,
      render: (r) => formatRupiah(r.spend),
      cardLabel: "Spend",
    },
    {
      key: "total_lead",
      header: "Lead",
      align: "right",
      sortable: true,
      accessor: (r) => r.total_lead,
      cardLabel: "Lead",
    },
    {
      key: "cpl_meta",
      header: "CPL",
      align: "right",
      sortable: true,
      accessor: (r) => r.cpl_meta,
      render: (r) => (r.cpl_meta ? formatRupiah(Math.round(r.cpl_meta)) : "-"),
      cardLabel: "CPL",
    },
    {
      key: "reached_consultation_pct",
      header: "→consult",
      align: "right",
      accessor: (r) => pct(r.reached_consultation, r.total_lead),
      render: (r) => formatPercent(pct(r.reached_consultation, r.total_lead)),
    },
    {
      key: "reached_offering_pct",
      header: "→offer",
      align: "right",
      accessor: (r) => pct(r.reached_offering, r.reached_consultation),
      render: (r) => formatPercent(pct(r.reached_offering, r.reached_consultation)),
    },
    {
      key: "reached_closing_pct",
      header: "→close",
      align: "right",
      accessor: (r) => pct(r.closing, r.reached_offering),
      render: (r) => formatPercent(pct(r.closing, r.reached_offering)),
    },
    {
      key: "closing",
      header: "Closing",
      align: "right",
      sortable: true,
      accessor: (r) => r.closing,
      cardLabel: "Closing",
    },
    {
      key: "gross_booking_value",
      header: "Omset",
      align: "right",
      sortable: true,
      accessor: (r) => r.gross_booking_value,
      render: (r) => formatRupiah(r.gross_booking_value),
      cardLabel: "Omset",
    },
    {
      key: "cpp",
      header: "CPP",
      align: "right",
      sortable: true,
      accessor: (r) => r.cpp,
      render: (r) => (r.cpp ? formatRupiah(Math.round(r.cpp)) : "-"),
      cardLabel: "CPP",
    },
    {
      key: "breakeven_cpp",
      header: "BE CPP",
      align: "right",
      accessor: (r) => r.breakeven_cpp,
      render: (r) => (r.breakeven_cpp ? formatRupiah(Math.round(r.breakeven_cpp)) : "-"),
    },
    {
      key: "roi",
      header: "ROI",
      align: "right",
      sortable: true,
      accessor: (r) => r.roi,
      render: (r) => <span className="font-semibold text-brass">{formatROI(r.roi)}</span>,
    },
    {
      key: "roas",
      header: "ROAS",
      align: "right",
      sortable: true,
      accessor: (r) => r.roas,
      render: (r) => formatMultiple(r.roas),
    },
  ];

  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-bold text-ink-900">Campaign Quality</h1>
      {error && <Banner variant="danger">{error}</Banner>}
      {loading && <p className="text-sm text-ink-400">Memuat...</p>}

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.campaign_id}
        defaultSortKey="roi"
        cardTitle={(r) => r.campaign_name}
        cardAccent={(r) => formatROI(r.roi)}
      />
    </div>
  );
}
