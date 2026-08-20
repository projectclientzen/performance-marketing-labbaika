"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import { formatRupiah } from "@/lib/utils/rupiah";
import { formatPercent } from "@/lib/utils/percent";
import { todayJakarta } from "@/lib/utils/date";
import { Banner } from "@/components/ui/Banner";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";

interface CsRow {
  cs_id: string;
  cs_name: string;
  total_lead: number;
  cold: number;
  consultation: number;
  offering: number;
  closing: number;
  gross_booking_value: number;
  avg_closing_interval: number | null;
  median_closing_interval: number | null;
  cancellation_rate: number | null;
  report_days: number;
}

export default function CsPerformancePage() {
  const [rows, setRows] = useState<CsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [daysInRange, setDaysInRange] = useState(1);

  useEffect(() => {
    const from = `${todayJakarta().slice(0, 7)}-01`;
    const to = todayJakarta();
    setDaysInRange(Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000) + 1);
    apiFetch<CsRow[]>(`/api/dashboard/cs-performance?from=${from}&to=${to}`)
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat"))
      .finally(() => setLoading(false));
  }, []);

  const columns: DataTableColumn<CsRow>[] = [
    { key: "cs_name", header: "CS", accessor: (r) => r.cs_name },
    {
      key: "report_days",
      header: "Hari Lapor",
      align: "right",
      sortable: true,
      accessor: (r) => r.report_days,
      render: (r) => `${r.report_days} / ${daysInRange}`,
      cardLabel: "Hari Lapor",
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
      render: (r) => <span className="font-semibold text-brass">{formatRupiah(r.gross_booking_value)}</span>,
      cardLabel: "Omset",
    },
    {
      key: "avg_closing_interval",
      header: "Avg Interval",
      align: "right",
      sortable: true,
      accessor: (r) => r.avg_closing_interval,
      render: (r) => (r.avg_closing_interval != null ? `${Math.round(r.avg_closing_interval)} hari` : "-"),
    },
    {
      key: "cancellation_rate",
      header: "Cancellation Rate",
      align: "right",
      accessor: (r) => r.cancellation_rate,
      render: (r) => formatPercent(r.cancellation_rate),
    },
  ];

  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-bold text-ink-900">CS Performance</h1>
      {error && <Banner variant="danger">{error}</Banner>}
      {loading && <p className="text-sm text-ink-400">Memuat...</p>}

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.cs_id}
        defaultSortKey="gross_booking_value"
        cardTitle={(r) => r.cs_name}
        cardAccent={(r) => `${r.report_days} / ${daysInRange}`}
      />
    </div>
  );
}
