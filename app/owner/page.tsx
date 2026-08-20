"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import { formatRupiah } from "@/lib/utils/rupiah";
import { formatPercent, formatROI } from "@/lib/utils/percent";
import { cppStatus } from "@/lib/utils/profit";
import { todayJakarta } from "@/lib/utils/date";
import { MetricCard } from "@/components/ui/MetricCard";
import { ThresholdCard } from "@/components/ui/ThresholdCard";
import { StageRail } from "@/components/ui/StageRail";
import { Banner } from "@/components/ui/Banner";

interface Overview {
  spend: number;
  meta_leads: number;
  total_lead: number;
  cold: number;
  consultation: number;
  offering: number;
  closing: number;
  reached_consultation: number;
  reached_offering: number;
  reached_closing: number;
  gross_booking_value: number;
  net_revenue: number;
  roi: number | null;
  roas: number | null;
  cpp: number | null;
  breakeven_cpp: number | null;
  campaign_attribution_rate: number | null;
  median_closing_interval_days: number | null;
}

function monthStart(): string {
  return `${todayJakarta().slice(0, 7)}-01`;
}

export default function OwnerOverviewPage() {
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(todayJakarta());
  const [attribution, setAttribution] = useState<"cash" | "cohort">("cash");
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiFetch<Overview>(`/api/dashboard/overview?from=${from}&to=${to}&attribution=${attribution}`)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat dashboard"))
      .finally(() => setLoading(false));
  }, [from, to, attribution]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 rounded-[10px] border border-line bg-card p-3">
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10 rounded-lg border border-line px-2 text-sm" />
        <span className="text-ink-400">—</span>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-10 rounded-lg border border-line px-2 text-sm" />
        <div className="ml-auto flex overflow-hidden rounded-lg border border-line text-sm">
          <button
            type="button"
            onClick={() => setAttribution("cash")}
            className={attribution === "cash" ? "bg-navy-900 px-3 py-2 text-text-light" : "px-3 py-2 text-ink-600"}
          >
            Cash basis
          </button>
          <button
            type="button"
            onClick={() => setAttribution("cohort")}
            className={attribution === "cohort" ? "bg-navy-900 px-3 py-2 text-text-light" : "px-3 py-2 text-ink-600"}
          >
            Cohort
          </button>
        </div>
      </div>

      {error && <Banner variant="danger">{error}</Banner>}

      {attribution === "cohort" && data?.median_closing_interval_days != null && (
        <Banner variant="info">
          Mode Cohort aktif. Median closing interval {Math.round(data.median_closing_interval_days)} hari — cohort
          terbaru mungkin belum matang sepenuhnya.
        </Banner>
      )}

      {data && data.campaign_attribution_rate !== null && data.campaign_attribution_rate < 0.6 && (
        <Banner variant="warn">
          Perbandingan campaign hanya mencakup {formatPercent(data.campaign_attribution_rate)} lead. Angka campaign
          di bawah belum mewakili keseluruhan.
        </Banner>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard label="Spend" value={formatRupiah(data?.spend ?? 0)} loading={loading} />
        <MetricCard label="Lead" value={String(data?.total_lead ?? 0)} loading={loading} />
        <MetricCard label="Closing" value={String(data?.closing ?? 0)} loading={loading} />
        <MetricCard label="Omset" value={formatRupiah(data?.gross_booking_value ?? 0)} loading={loading} />
      </div>

      <MetricCard label="ROI" value={formatROI(data?.roi ?? null)} variant="accent" loading={loading} />

      {data && (
        <ThresholdCard
          leftLabel="CPP aktual"
          leftValue={formatRupiah(data.cpp ?? 0)}
          rightLabel="Break-even CPP"
          rightValue={formatRupiah(data.breakeven_cpp ?? 0)}
          status={cppStatus(data.cpp, data.breakeven_cpp)}
        />
      )}

      {data && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-ink-600">Funnel (kumulatif)</h2>
          <StageRail
            size="large"
            withNumbers
            segments={[
              { stage: "cold", value: data.total_lead - data.reached_consultation },
              { stage: "consultation", value: data.reached_consultation - data.reached_offering },
              { stage: "offering", value: data.reached_offering - data.reached_closing },
              { stage: "closing", value: data.reached_closing },
            ]}
          />
          <p className="mt-2 text-xs text-ink-400">
            Distribusi akhir lead: cold {data.cold}, consultation {data.consultation}, offering {data.offering},
            closing {data.closing} — lead berhenti di stage ini, bukan conversion rate.
          </p>
        </section>
      )}
    </div>
  );
}
