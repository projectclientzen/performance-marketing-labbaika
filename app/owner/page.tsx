"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import { formatRupiah } from "@/lib/utils/rupiah";
import { formatPercent, formatROI } from "@/lib/utils/percent";
import { cppStatus } from "@/lib/utils/profit";
import { formatDateID, parseDateID, todayJakarta } from "@/lib/utils/date";
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

/**
 * Rentang tanggal pendek untuk judul mobile — prototype: "1–19 Agu 2026".
 * Kalau bulan sama, angka hari saja untuk sisi kiri; kalau beda, dua tanggal
 * penuh. Presentasi murni untuk satu tempat ini, jadi dibuat lokal alih-alih
 * menambah fungsi baru ke lib/utils/date.ts.
 */
function shortDateRange(from: string, to: string): string {
  const a = parseDateID(from);
  const b = parseDateID(to);
  const sameMonth = a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
  return sameMonth ? `${a.getDate()}–${formatDateID(to)}` : `${formatDateID(from)}–${formatDateID(to)}`;
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

interface ProgramClosing {
  program_id: string;
  program_name: string;
  closing: number;
  omset: number;
}

interface SourceSplit {
  paid: number;
  other: number;
  paid_omset: number;
  other_omset: number;
}

/** Donut closing paid vs other. SVG murni, dua segmen stroke pada satu circle. */
function ClosingSourceDonut({ split }: { split: SourceSplit }) {
  const total = split.paid + split.other;
  const r = 52;
  const c = 2 * Math.PI * r;
  const paidFrac = total > 0 ? split.paid / total : 0;
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
  const rows = [
    { label: "Paid traffic (iklan)", value: split.paid, omset: split.paid_omset, color: "var(--color-stage-closing)" },
    { label: "Other (organik)", value: split.other, omset: split.other_omset, color: "var(--color-stage-consult)" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="relative h-[140px] w-[140px] shrink-0">
        <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
          <circle cx="70" cy="70" r={r} fill="none" stroke="var(--color-paper)" strokeWidth="16" />
          {total > 0 && (
            <>
              <circle
                cx="70" cy="70" r={r} fill="none" stroke="var(--color-stage-closing)" strokeWidth="16"
                strokeDasharray={`${paidFrac * c} ${c}`}
              />
              <circle
                cx="70" cy="70" r={r} fill="none" stroke="var(--color-stage-consult)" strokeWidth="16"
                strokeDasharray={`${(1 - paidFrac) * c} ${c}`}
                strokeDashoffset={`${-paidFrac * c}`}
              />
            </>
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-2xl font-semibold text-ink-900">{total}</span>
          <span className="text-[11px] text-ink-400">closing</span>
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-2.5">
        {rows.map((row) => (
          <div key={row.label}>
            <div className="flex items-center justify-between text-sm">
              <span className="inline-flex items-center gap-1.5 text-ink-900">
                <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.color }} />
                {row.label}
              </span>
              <span className="font-mono font-semibold text-ink-900">
                {row.value} · {pct(row.value)}%
              </span>
            </div>
            <p className="ml-4 text-[11px] text-ink-400">{formatRupiah(row.omset)}</p>
          </div>
        ))}
        {total === 0 && <p className="text-sm text-ink-400">Belum ada closing untuk periode ini.</p>}
      </div>
    </div>
  );
}

export default function OwnerOverviewPage() {
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(todayJakarta());
  const [attribution, setAttribution] = useState<"cash" | "cohort">("cash");
  const [data, setData] = useState<Overview | null>(null);
  const [split, setSplit] = useState<SourceSplit | null>(null);
  const [byProgram, setByProgram] = useState<ProgramClosing[]>([]);
  const [programFilter, setProgramFilter] = useState<string>("all");
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

  useEffect(() => {
    apiFetch<SourceSplit>(`/api/dashboard/closing-source-split?from=${from}&to=${to}`)
      .then(setSplit)
      .catch(() => setSplit(null));
    apiFetch<ProgramClosing[]>(`/api/dashboard/closings-by-program?from=${from}&to=${to}`)
      .then(setByProgram)
      .catch(() => setByProgram([]));
  }, [from, to]);

  const modeLabel = attribution === "cash" ? "Cash basis" : "Cohort";
  const carry = (num: number, den: number) =>
    den > 0 ? `${Math.round((num / den) * 100)}% lanjut` : "–";

  return (
    <div className="space-y-4">
      {/* Judul halaman versi mobile. Diukur dari frame mobile F-07 di
          prototype: "Overview" 18px/700 kiri, rentang tanggal pendek kanan —
          teks ini hidup DI DALAM konten halaman di prototype, bukan di
          kerangka (layout.tsx), karena tiap layar Owner punya judulnya
          sendiri. Desktop tidak menampilkan judul terpisah di sini —
          nav sidebar sudah cukup jadi penanda posisi, sama seperti
          prototype desktop yang juga tidak mengulang judul di konten. */}
      <div className="flex items-baseline justify-between md:hidden">
        <h1 className="font-display text-lg font-bold text-ink-900">Overview</h1>
        <span className="font-mono text-xs text-ink-400">{shortDateRange(from, to)}</span>
      </div>

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

      {/* Desktop: 4 MetricCard dengan caption (Meta Ads/CPL/CPP/biaya iklan),
          plus ROI hero + ThresholdCard berdampingan — tidak berubah. */}
      <div className="hidden gap-3.5 md:grid md:grid-cols-4">
        <MetricCard label="Spend" value={formatRupiah(data?.spend ?? 0)} delta="Meta Ads" loading={loading} />
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
          delta={data?.ad_cost_ratio != null ? `biaya iklan ${formatPercent(data.ad_cost_ratio)}` : undefined}
          loading={loading}
        />
      </div>

      <div className="hidden gap-3.5 md:grid md:grid-cols-2">
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

      {/* Mobile: markup lokal, tidak lewat MetricCard/ThresholdCard.
          Diukur dari frame mobile F-07 — kartunya lebih ringkas daripada
          desktop, TANPA baris caption sama sekali (bukan disembunyikan,
          memang tidak ada di prototype): tanpa "Meta Ads"/"CPL"/"CPP"/
          "biaya iklan" di bawah angka, dan tanpa kalimat "Setiap Rp1..."
          di kartu ROI maupun baris "CPP di X% break-even · ambang 70%" di
          kartu threshold. MetricCard/ThresholdCard baru menerima props
          opsional yang selalu menggambar sebagian baris itu, jadi dibuat
          markup sendiri di sini daripada mengubah komponen milik Track A. */}
      <div className="rounded-card bg-ink-900 p-5 md:hidden">
        <span className="text-[13px] text-on-dark-muted">ROI</span>
        <span className="ml-2 rounded-chip bg-navy-700 px-2 py-0.5 font-mono text-[10px] text-on-dark-muted">
          estimasi
        </span>
        <div className="mt-2 font-mono text-[40px] font-semibold leading-none text-brass">
          {loading ? "—" : formatROI(data?.roi ?? null)}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:hidden">
        <div className="rounded-card border border-line bg-card p-4">
          <p className="text-[13px] text-ink-400">Spend</p>
          <p className="mt-1.5 font-mono text-[22px] font-semibold text-ink-900">
            {formatRupiah(data?.spend ?? 0)}
          </p>
        </div>
        <div className="rounded-card border border-line bg-card p-4">
          <p className="text-[13px] text-ink-400">Lead</p>
          <p className="mt-1.5 font-mono text-[22px] font-semibold text-ink-900">
            {(data?.total_lead ?? 0).toLocaleString("id-ID")}
          </p>
        </div>
        <div className="rounded-card border border-line bg-card p-4">
          <p className="text-[13px] text-ink-400">Closing</p>
          <p className="mt-1.5 font-mono text-[22px] font-semibold text-ink-900">
            {(data?.closing ?? 0).toLocaleString("id-ID")}
          </p>
        </div>
        <div className="rounded-card border border-line bg-card p-4">
          <p className="text-[13px] text-ink-400">Omset</p>
          <p className="mt-1.5 font-mono text-[22px] font-semibold text-ink-900">
            {formatRupiah(data?.gross_booking_value ?? 0)}
          </p>
        </div>
      </div>

      {data && (
        <div className="rounded-card border border-line bg-card p-4 md:hidden">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-semibold text-ink-900">CPP vs Break-even</h3>
            <span
              className={`rounded-chip px-2 py-0.5 text-[11px] font-medium ${
                cppStatus(data.cpp, data.breakeven_cpp) === "safe"
                  ? "bg-ok/10 text-ok"
                  : cppStatus(data.cpp, data.breakeven_cpp) === "warning"
                    ? "bg-warn/10 text-warn"
                    : "bg-danger/10 text-danger"
              }`}
            >
              {cppStatus(data.cpp, data.breakeven_cpp) === "safe"
                ? "aman"
                : cppStatus(data.cpp, data.breakeven_cpp) === "warning"
                  ? "hati-hati"
                  : "lewat ambang"}
            </span>
          </div>
          <div className="mt-3 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs text-ink-400">CPP</p>
              <p className="mt-0.5 font-mono text-lg font-semibold text-ok">
                {formatRupiah(Math.round(data.cpp ?? 0))}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-ink-400">Break-even</p>
              <p className="mt-0.5 font-mono text-lg font-semibold text-ink-900">
                {formatRupiah(Math.round(data.breakeven_cpp ?? 0))}
              </p>
            </div>
          </div>
        </div>
      )}

      {data && (
        <section className="rounded-card border border-line bg-card p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            {/* Judul dipendekkan di mobile (prototype: "Funnel" tanpa
                suffix mode) — desktop tetap menyebut mode Cash/Cohort. */}
            <h2 className="font-display text-sm font-semibold text-ink-900">
              <span className="md:hidden">Funnel</span>
              <span className="hidden md:inline">Funnel — {modeLabel}</span>
            </h2>
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

          {/* Legend distribusi bucket mentah: tidak muncul di frame mobile
              prototype (kartu Funnel-nya berhenti setelah baris Closing),
              jadi disembunyikan di bawah 768px. */}
          <div className="mt-4 hidden border-t border-line pt-3 md:block">
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

      {/* Closing: paid traffic vs other. Bagan pembagi — bukan bagian metrik
          ad-funnel; menghitung semua closing hanya untuk melihat porsinya. */}
      <section className="rounded-card border border-line bg-card p-4">
        <h2 className="mb-1 text-sm font-semibold text-ink-600">Closing: paid traffic vs other</h2>
        <p className="mb-4 text-xs text-ink-400">
          Porsi closing dari iklan (tertaut campaign) vs organik/lainnya. Terpisah dari ROI iklan.
        </p>
        {split ? (
          <ClosingSourceDonut split={split} />
        ) : (
          <p className="text-sm text-ink-400">Memuat...</p>
        )}
      </section>

      {/* Closing per program — program mana yang paling banyak closing, plus
          filter untuk menyorot satu program. Cacah closing murni, terpisah
          dari metrik ad-funnel. */}
      <section className="rounded-card border border-line bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink-600">Closing per program</h2>
          <select
            value={programFilter}
            onChange={(e) => setProgramFilter(e.target.value)}
            className="h-9 rounded-lg border border-line px-2 text-sm text-ink-900"
          >
            <option value="all">Semua program</option>
            {byProgram.map((p) => (
              <option key={p.program_id} value={p.program_id}>
                {p.program_name}
              </option>
            ))}
          </select>
        </div>
        {(() => {
          const shown =
            programFilter === "all"
              ? byProgram
              : byProgram.filter((p) => p.program_id === programFilter);
          const maxClosing = Math.max(1, ...byProgram.map((p) => p.closing));
          if (byProgram.length === 0) {
            return <p className="text-sm text-ink-400">Belum ada closing untuk periode ini.</p>;
          }
          return (
            <div className="space-y-3">
              {shown.map((p, i) => (
                <div key={p.program_id}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate text-ink-900">
                      {programFilter === "all" && i === 0 ? "🏆 " : ""}
                      {p.program_name}
                    </span>
                    <span className="shrink-0 font-mono text-ink-600">
                      {p.closing} closing · {formatRupiah(p.omset)}
                    </span>
                  </div>
                  <div className="h-[24px] w-full overflow-hidden rounded-md bg-paper">
                    <div
                      className="h-full rounded-md bg-stage-closing"
                      style={{ width: `${(p.closing / maxClosing) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
      </section>
    </div>
  );
}
