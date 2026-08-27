"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import { formatRupiah } from "@/lib/utils/rupiah";
import { formatPercent, formatROI, formatMultiple } from "@/lib/utils/percent";
import { cppStatus } from "@/lib/utils/profit";
import { Banner } from "@/components/ui/Banner";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { DateRangePresets, rangeForPreset, type RangePreset } from "@/components/ui/DateRangePresets";

interface CampaignRow {
  campaign_id: string;
  campaign_name: string;
  spend: number;
  meta_leads: number;
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

// Opsi dropdown "Urut:" mobile — persis 3 pilihan di frame mobile F-08
// prototype (value/label/arah dari combobox "ROI tertinggi" prototype).
// CPP ascending karena CPP yang lebih murah lebih baik; ROI dan Spend
// descending karena lebih besar lebih baik.
const MOBILE_SORT_OPTIONS = [
  { value: "roi", label: "ROI tertinggi", key: "roi", dir: "desc" as const },
  { value: "cpp", label: "CPP terendah", key: "cpp", dir: "asc" as const },
  { value: "spend", label: "Spend tertinggi", key: "spend", dir: "desc" as const },
];

export default function CampaignQualityPage() {
  const [rows, setRows] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mobileSort, setMobileSort] = useState(MOBILE_SORT_OPTIONS[0]);
  const [range, setRange] = useState<{ preset: RangePreset; from: string; to: string }>(() => ({
    preset: "bulan-ini",
    ...rangeForPreset("bulan-ini"),
  }));

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiFetch<CampaignRow[]>(
      `/api/dashboard/campaigns?from=${range.from}&to=${range.to}&attribution=cohort`,
    )
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat"))
      .finally(() => setLoading(false));
  }, [range.from, range.to]);

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
      key: "meta_leads",
      header: "Lead",
      align: "right",
      sortable: true,
      accessor: (r) => r.meta_leads,
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
      // cardLabel ditambahkan -- di prototype mobile, ketiga kolom
      // konversi antar-stage ini MUNCUL di kartu (bukan cuma di tabel
      // desktop). Tanpa cardLabel, DataTable diam-diam membuang kolom ini
      // dari tampilan kartu (lihat DataTable.tsx: hanya kolom ber-cardLabel
      // yang dirender di kartu mobile).
      key: "reached_consultation_pct",
      header: "→consult",
      align: "right",
      accessor: (r) => pct(r.reached_consultation, r.total_lead),
      render: (r) => formatPercent(pct(r.reached_consultation, r.total_lead)),
      cardLabel: "→consult",
    },
    {
      key: "reached_offering_pct",
      header: "→offer",
      align: "right",
      accessor: (r) => pct(r.reached_offering, r.reached_consultation),
      render: (r) => formatPercent(pct(r.reached_offering, r.reached_consultation)),
      cardLabel: "→offer",
    },
    {
      key: "reached_closing_pct",
      header: "→close",
      align: "right",
      accessor: (r) => pct(r.closing, r.reached_offering),
      render: (r) => formatPercent(pct(r.closing, r.reached_offering)),
      cardLabel: "→close",
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
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-xl font-bold text-ink-900">Campaign Quality</h1>
        {/* "Urut:" mobile -- DataTable tidak mengekspos sort sebagai state
            terkendali (§4 work order: API-nya milik Track A, dibekukan).
            Dipilih pendekatan yang tidak mengubah DataTable sama sekali:
            `key={mobileSort.value}` memaksa React memasang ulang komponen
            saat pilihan berubah, sehingga defaultSortKey/Dir yang baru
            dibaca dari awal. Header tabel desktop tetap bisa diklik untuk
            menimpa urutan seperti biasa -- ini cuma menentukan urutan
            AWAL, sama seperti defaultSortKey statis yang sudah ada
            sebelumnya, hanya sekarang bisa diganti dari mobile. */}
        <label className="flex items-center gap-1.5 text-xs text-ink-600 md:hidden">
          Urut:
          <select
            value={mobileSort.value}
            onChange={(e) => {
              const next = MOBILE_SORT_OPTIONS.find((o) => o.value === e.target.value);
              if (next) setMobileSort(next);
            }}
            className="h-8 rounded-input border border-line bg-card px-2 text-xs text-ink-900"
          >
            {MOBILE_SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <DateRangePresets
        preset={range.preset}
        from={range.from}
        to={range.to}
        onChange={setRange}
      />

      {error && <Banner variant="danger">{error}</Banner>}
      {loading && <p className="text-sm text-ink-400">Memuat...</p>}

      <DataTable
        key={mobileSort.value}
        columns={columns}
        rows={rows}
        rowKey={(r) => r.campaign_id}
        defaultSortKey={mobileSort.key}
        defaultSortDir={mobileSort.dir}
        cardTitle={(r) => r.campaign_name}
        cardAccent={(r) => formatROI(r.roi)}
        // Border kiri kartu: hijau kalau sehat (CPP di bawah break-even),
        // merah kalau rugi (CPP >= break-even) — prototype F-08 mobile.
        cardBorderColor={(r) =>
          cppStatus(r.cpp, r.breakeven_cpp) === "over" ? "var(--color-danger)" : "var(--color-ok)"
        }
      />
    </div>
  );
}
