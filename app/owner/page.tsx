"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import { formatRupiah } from "@/lib/utils/rupiah";
import { formatPercent, formatROI } from "@/lib/utils/percent";
import { cppStatus } from "@/lib/utils/profit";
import { todayJakarta } from "@/lib/utils/date";
import { MetricCard } from "@/components/ui/MetricCard";
import { ThresholdCard } from "@/components/ui/ThresholdCard";
import { Banner } from "@/components/ui/Banner";

interface Overview {
  spend: number;
  meta_leads: number;
  cpl_meta: number | null;
  total_lead: number;
  cold: number;
  consultation: number;
  offering: number;
  closing: number;
  reached_consultation: number;
  reached_offering: number;
  reached_closing: number;
  gross_booking_value: number;
  collected_revenue: number;
  cancellation_rate: number | null;
  net_revenue: number;
  roi: number | null;
  roas: number | null;
  cpp: number | null;
  breakeven_cpp: number | null;
  ad_cost_ratio: number | null;
  campaign_attribution_rate: number | null;
  median_closing_interval_days: number | null;
}

function monthStart(): string {
  return `${todayJakarta().slice(0, 7)}-01`;
}

/** Baris funnel — batang proporsional dengan angka di dalamnya (F-07). */
function FunnelRow({
  label,
  value,
  max,
  color,
  carry,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  carry: string;
}) {
  const pct = max > 0 ? Math.max((value / max) * 100, value > 0 ? 6 : 0) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 text-[13px] text-ink-600">{label}</span>
      <div className="h-8 flex-1 rounded-md bg-paper">
        <div
          className="flex h-full items-center rounded-md px-2.5 transition-all duration-200"
          style={{ width: `${pct}%`, backgroundColor: color, minWidth: value > 0 ? "3.5rem" : 0 }}
        >
          <span className="font-mono text-[13px] font-semibold text-card">
            {value.toLocaleString("id-ID")}
          </span>
        </div>
      </div>
      <span className="w-20 shrink-0 text-right font-mono text-[11px] text-ink-400">{carry}</span>
    </div>
  );
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

  const modeLabel = attribution === "cash" ? "Cash basis" : "Cohort";
  const carry = (num: number, den: number) =>
    den > 0 ? `${Math.round((num / den) * 100)}% lanjut` : "–";

  return (
    <div className="space-y-4">
      {/* Filter bar. Prototype juga punya pemilih brand dan source; keduanya
          belum disambungkan ke data (sistem ini satu brand, dan filter source
          belum dipakai halaman manapun), jadi tidak ditampilkan sebagai kontrol
          mati yang menyesatkan. */}
      <div className="flex flex-wrap items-center gap-2 rounded-card border border-line bg-card p-2.5">
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="h-9 rounded-input border border-line px-2.5 font-mono text-[13px] text-ink-900"
        />
        <span className="text-ink-400">–</span>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="h-9 rounded-input border border-line px-2.5 font-mono text-[13px] text-ink-900"
        />
        <div className="ml-auto flex rounded-chip bg-paper p-0.5 text-[13px]">
          {(["cash", "cohort"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setAttribution(mode)}
              className={`rounded-chip px-3.5 py-1.5 transition-colors duration-200 ${
                attribution === mode ? "bg-ink-900 font-medium text-on-dark" : "text-ink-600"
              }`}
            >
              {mode === "cash" ? "Cash basis" : "Cohort"}
            </button>
          ))}
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

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <MetricCard
          label="Spend"
          value={formatRupiah(data?.spend ?? 0)}
          delta="Meta Ads"
          loading={loading}
        />
        <MetricCard
          label="Lead"
          value={(data?.total_lead ?? 0).toLocaleString("id-ID")}
          delta={data?.cpl_meta != null ? `CPL ${formatRupiah(Math.round(data.cpl_meta))}` : undefined}
          loading={loading}
        />
        <MetricCard
          label="Closing"
          value={(data?.closing ?? 0).toLocaleString("id-ID")}
          delta={data?.cpp != null ? `CPP ${formatRupiah(Math.round(data.cpp))}` : undefined}
          loading={loading}
        />
        <MetricCard
          label="Omset"
          value={formatRupiah(data?.gross_booking_value ?? 0)}
          delta={
            data?.ad_cost_ratio != null ? `biaya iklan ${formatPercent(data.ad_cost_ratio)}` : undefined
          }
          loading={loading}
        />
      </div>

      <div className="grid gap-3.5 lg:grid-cols-2">
        {/* Kartu ROI — satu angka kunci per layar, aksen brass di atas navy.
            Kalimat di prototype berbunyi "menghasilkan Rp9,08 gross profit";
            gross profit sudah di luar lingkup (migrasi 023), jadi diganti
            omset — angkanya memang omset per rupiah iklan, yaitu ROAS. */}
        <div className="rounded-card bg-ink-900 p-5">
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-on-dark-muted">ROI (mode {modeLabel})</span>
          </div>
          <div className="mt-3 font-mono text-[52px] font-semibold leading-none text-brass">
            {loading ? "—" : formatROI(data?.roi ?? null)}
          </div>
          <p className="mt-3 text-[13px] text-on-dark-muted">
            {data?.roas != null
              ? `Setiap Rp1 iklan menghasilkan ${formatRupiah(Math.round(data.roas))} omset.`
              : "Belum ada spend iklan pada periode ini."}
          </p>
        </div>

        {data && (
          <ThresholdCard
            leftLabel="CPP aktual"
            leftValue={formatRupiah(Math.round(data.cpp ?? 0))}
            rightLabel="Break-even"
            rightValue={formatRupiah(Math.round(data.breakeven_cpp ?? 0))}
            status={cppStatus(data.cpp, data.breakeven_cpp)}
            ratio={
              data.cpp != null && data.breakeven_cpp ? data.cpp / data.breakeven_cpp : undefined
            }
            note={
              data.cpp != null && data.breakeven_cpp
                ? `CPP di ${formatPercent(data.cpp / data.breakeven_cpp)} break-even`
                : undefined
            }
          />
        )}
      </div>

      {data && (
        <section className="rounded-card border border-line bg-card p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-sm font-semibold text-ink-900">Funnel — {modeLabel}</h2>
            {/* Lama lead menjadi closing. Datanya sudah ada sejak awal —
                closings.interval_days kolom generated (closing_date - lead_date)
                di 004 — tapi selama ini hanya dipakai diam-diam untuk banner
                Cohort, tidak pernah ditampilkan sebagai angka.
                Median, bukan rata-rata: satu closing yang datang 200 hari
                kemudian menggeser rata-rata jauh dari pengalaman sehari-hari,
                sementara median tidak. Rata-rata per CS tetap ada di F-09. */}
            <span className="text-xs text-ink-400">
              Median lead → closing{" "}
              <span className="font-mono font-semibold text-ink-900">
                {data.median_closing_interval_days != null
                  ? `${Math.round(data.median_closing_interval_days)} hari`
                  : "—"}
              </span>
            </span>
          </div>

          <div className="mt-3.5 space-y-2">
            <FunnelRow
              label="Lead"
              value={data.total_lead}
              max={data.total_lead}
              color="var(--color-stage-cold)"
              carry={carry(data.reached_consultation, data.total_lead)}
            />
            <FunnelRow
              label="Consultation"
              value={data.reached_consultation}
              max={data.total_lead}
              color="var(--color-stage-consult)"
              carry={carry(data.reached_offering, data.reached_consultation)}
            />
            <FunnelRow
              label="Offering"
              value={data.reached_offering}
              max={data.total_lead}
              color="var(--color-stage-offer)"
              carry={carry(data.reached_closing, data.reached_offering)}
            />
            <FunnelRow
              label="Closing"
              value={data.reached_closing}
              max={data.total_lead}
              color="var(--color-stage-closing)"
              carry="–"
            />
          </div>

          <div className="mt-4 border-t border-line pt-3">
            <p className="text-[11px] text-ink-400">
              Distribusi akhir lead (bucket mentah, bukan funnel)
            </p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-ink-600">
              {[
                { label: "Cold", value: data.cold, color: "var(--color-stage-cold)" },
                { label: "Consultation", value: data.consultation, color: "var(--color-stage-consult)" },
                { label: "Offering", value: data.offering, color: "var(--color-stage-offer)" },
                { label: "Closing", value: data.closing, color: "var(--color-stage-closing)" },
              ].map((s) => (
                <span key={s.label} className="inline-flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: s.color }}
                  />
                  {s.label} <span className="font-mono font-semibold text-ink-900">{s.value.toLocaleString("id-ID")}</span>
                </span>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
