"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api/client";
import { formatRupiah } from "@/lib/utils/rupiah";
import { formatPercent, formatROI, formatMultiple } from "@/lib/utils/percent";
import { formatDateID, todayJakarta } from "@/lib/utils/date";
import { cppStatus } from "@/lib/utils/profit";

interface Overview {
  spend: number;
  total_lead: number;
  cold: number;
  consultation: number;
  offering: number;
  closing: number;
  reached_consultation: number;
  reached_offering: number;
  gross_booking_value: number;
  roi: number | null;
  roas: number | null;
  cpp: number | null;
  breakeven_cpp: number | null;
  cpl_meta: number | null;
}
interface Campaign {
  campaign_id: string;
  campaign_name: string;
  spend: number;
  total_lead: number;
  reached_consultation: number;
  reached_offering: number;
  closing: number;
  gross_booking_value: number;
  cpp: number | null;
  breakeven_cpp: number | null;
  roi: number | null;
}
interface Insight {
  category_id: string;
  category_name: string;
  lead_count: number;
  pct_of_filled: number | null;
}

/** Biaya per satuan; null kalau penyebut nol supaya tidak menampilkan Infinity. */
function per(cost: number, count: number): number | null {
  return count > 0 ? cost / count : null;
}

function AnalisaReport() {
  const sp = useSearchParams();
  const from = sp.get("from") ?? `${todayJakarta().slice(0, 7)}-01`;
  const to = sp.get("to") ?? todayJakarta();

  const [overview, setOverview] = useState<Overview | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = `from=${from}&to=${to}`;
    Promise.all([
      apiFetch<Overview>(`/api/dashboard/overview?${q}`),
      apiFetch<Campaign[]>(`/api/dashboard/campaigns?${q}`),
      apiFetch<Insight[]>(`/api/dashboard/insights?${q}`),
    ])
      .then(([o, c, i]) => {
        setOverview(o);
        setCampaigns(c);
        setInsights(i);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat data"))
      .finally(() => setLoading(false));
  }, [from, to]);

  if (loading) return <p className="p-8 text-sm text-ink-400">Menyusun laporan…</p>;
  if (error) return <p className="p-8 text-sm text-danger">{error}</p>;
  if (!overview) return null;

  const o = overview;
  const totalInsight = insights.reduce((s, r) => s + r.lead_count, 0);

  const rupiah = (v: number | null) => (v == null ? "—" : formatRupiah(Math.round(v)));

  const cplRows = [
    { label: "CPL real (lead masuk)", value: per(o.spend, o.total_lead), note: `${o.total_lead.toLocaleString("id-ID")} lead` },
    { label: "CPL konsultasi", value: per(o.spend, o.reached_consultation), note: `${o.reached_consultation.toLocaleString("id-ID")} sampai konsultasi` },
    { label: "CPL potensial (offering)", value: per(o.spend, o.reached_offering), note: `${o.reached_offering.toLocaleString("id-ID")} sampai penawaran` },
    { label: "CPP (per closing)", value: o.cpp, note: `${o.closing.toLocaleString("id-ID")} closing` },
  ];

  const funnel = [
    { label: "Lead masuk", value: o.total_lead, base: o.total_lead },
    { label: "Konsultasi", value: o.reached_consultation, base: o.total_lead },
    { label: "Penawaran", value: o.reached_offering, base: o.reached_consultation },
    { label: "Closing", value: o.closing, base: o.reached_offering },
  ];

  return (
    <div className="report mx-auto max-w-[820px] bg-card p-8 text-ink-900 print:max-w-none print:p-0">
      {/* Aturan cetak: sembunyikan kerangka aplikasi, atur halaman A4. */}
      <style>{`
        @media print {
          @page { size: A4; margin: 16mm 14mm; }
          aside, header, nav, .no-print { display: none !important; }
          main { padding: 0 !important; }
          .report { max-width: none !important; padding: 0 !important; box-shadow: none !important; }
          .avoid-break { break-inside: avoid; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      {/* Kontrol — tidak ikut tercetak */}
      <div className="no-print mb-6 flex items-center justify-between border-b border-line pb-4">
        <p className="text-sm text-ink-600">Pratinjau laporan · pakai tombol untuk menyimpan sebagai PDF.</p>
        <button
          type="button"
          onClick={() => window.print()}
          className="h-10 rounded-lg bg-brass px-4 text-sm font-semibold text-on-brass"
        >
          Simpan sebagai PDF
        </button>
      </div>

      {/* Kop */}
      <header className="mb-6 border-b-2 border-ink-900 pb-4">
        <h1 className="font-display text-2xl font-bold">Laporan Analisa Performa</h1>
        <p className="mt-1 text-sm text-ink-600">Labbaika Group · Performance Marketing</p>
        <p className="mt-2 font-mono text-[13px] text-ink-600">
          Periode {formatDateID(from)} – {formatDateID(to)} · dibuat {formatDateID(todayJakarta())}
        </p>
      </header>

      {/* Ringkasan eksekutif */}
      <section className="avoid-break mb-7">
        <h2 className="mb-3 font-display text-lg font-semibold">Ringkasan Eksekutif</h2>
        <div className="grid grid-cols-3 gap-3">
          {[
            { l: "Spend iklan", v: rupiah(o.spend) },
            { l: "Total lead", v: o.total_lead.toLocaleString("id-ID") },
            { l: "Closing", v: o.closing.toLocaleString("id-ID") },
            { l: "Omset (gross booking)", v: rupiah(o.gross_booking_value) },
            { l: "ROI", v: formatROI(o.roi) },
            { l: "ROAS", v: formatMultiple(o.roas) },
          ].map((m) => (
            <div key={m.l} className="rounded-lg border border-line p-3">
              <p className="text-[11px] uppercase tracking-wide text-ink-400">{m.l}</p>
              <p className="mt-0.5 font-mono text-lg font-semibold">{m.v}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-lg bg-paper p-3 text-[13px] text-ink-600">
          CPP aktual <b className="font-mono text-ink-900">{rupiah(o.cpp)}</b> vs break-even{" "}
          <b className="font-mono text-ink-900">{rupiah(o.breakeven_cpp)}</b>
          {o.cpp != null && o.breakeven_cpp != null && (
            <> — {cppStatus(o.cpp, o.breakeven_cpp) === "over" ? "⚠ di atas ambang (rugi)" : "✓ sehat"}</>
          )}
        </div>
      </section>

      {/* Corong + CPL */}
      <section className="avoid-break mb-7 grid grid-cols-2 gap-6">
        <div>
          <h2 className="mb-3 font-display text-lg font-semibold">Corong Lead</h2>
          <table className="w-full text-sm">
            <tbody>
              {funnel.map((f) => (
                <tr key={f.label} className="border-b border-line last:border-0">
                  <td className="py-1.5 text-ink-600">{f.label}</td>
                  <td className="py-1.5 text-right font-mono font-medium">{f.value.toLocaleString("id-ID")}</td>
                  <td className="py-1.5 pl-3 text-right font-mono text-[12px] text-ink-400">
                    {f.label === "Lead masuk" ? "—" : formatPercent(per(f.value, f.base))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <h2 className="mb-3 font-display text-lg font-semibold">Biaya per Lead (CPL)</h2>
          <table className="w-full text-sm">
            <tbody>
              {cplRows.map((r) => (
                <tr key={r.label} className="border-b border-line last:border-0">
                  <td className="py-1.5 text-ink-600">
                    {r.label}
                    <span className="block font-mono text-[11px] text-ink-400">{r.note}</span>
                  </td>
                  <td className="py-1.5 text-right font-mono font-medium">{rupiah(r.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Quality per campaign */}
      <section className="mb-7">
        <h2 className="mb-3 font-display text-lg font-semibold">Kualitas Lead per Campaign</h2>
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b-2 border-ink-900 text-left text-ink-600">
              <th className="py-2 pr-2">Campaign</th>
              <th className="py-2 px-2 text-right">Spend</th>
              <th className="py-2 px-2 text-right">Lead</th>
              <th className="py-2 px-2 text-right">CPL real</th>
              <th className="py-2 px-2 text-right">→Konsul</th>
              <th className="py-2 px-2 text-right">→Offer</th>
              <th className="py-2 px-2 text-right">Closing</th>
              <th className="py-2 px-2 text-right">CPP</th>
              <th className="py-2 pl-2 text-right">ROI</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {campaigns.map((c) => {
              const status = cppStatus(c.cpp, c.breakeven_cpp);
              return (
                <tr key={c.campaign_id} className="avoid-break border-b border-line">
                  <td className="py-1.5 pr-2 font-sans">
                    <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${status === "over" ? "bg-danger" : "bg-ok"}`} />
                    {c.campaign_name}
                  </td>
                  <td className="py-1.5 px-2 text-right">{rupiah(c.spend)}</td>
                  <td className="py-1.5 px-2 text-right">{c.total_lead.toLocaleString("id-ID")}</td>
                  <td className="py-1.5 px-2 text-right">{rupiah(per(c.spend, c.total_lead))}</td>
                  <td className="py-1.5 px-2 text-right">{formatPercent(per(c.reached_consultation, c.total_lead))}</td>
                  <td className="py-1.5 px-2 text-right">{formatPercent(per(c.reached_offering, c.reached_consultation))}</td>
                  <td className="py-1.5 px-2 text-right">{c.closing.toLocaleString("id-ID")}</td>
                  <td className="py-1.5 px-2 text-right">{rupiah(c.cpp)}</td>
                  <td className="py-1.5 pl-2 text-right">{formatROI(c.roi)}</td>
                </tr>
              );
            })}
            {campaigns.length === 0 && (
              <tr>
                <td colSpan={9} className="py-3 text-center font-sans text-ink-400">
                  Belum ada data campaign untuk periode ini.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <p className="mt-2 text-[11px] text-ink-400">● hijau = CPP sehat (di bawah break-even) · ● merah = CPP di atas break-even (rugi).</p>
      </section>

      {/* Alasan belum closing */}
      <section className="avoid-break mb-6">
        <h2 className="mb-3 font-display text-lg font-semibold">Alasan Lead Belum Closing</h2>
        {insights.length === 0 ? (
          <p className="text-sm text-ink-400">Belum ada insight alasan yang diberi CS untuk periode ini.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-ink-600">
                <th className="py-2">Alasan</th>
                <th className="py-2 text-right">Jumlah lead</th>
                <th className="py-2 text-right">% dari yang diberi alasan</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {insights.map((r) => (
                <tr key={r.category_id} className="border-b border-line last:border-0">
                  <td className="py-1.5 font-sans">{r.category_name}</td>
                  <td className="py-1.5 text-right">{r.lead_count.toLocaleString("id-ID")}</td>
                  <td className="py-1.5 text-right">{formatPercent(per(r.lead_count, totalInsight))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-2 text-[11px] text-ink-400">
          Denominator: {totalInsight.toLocaleString("id-ID")} lead offering yang diberi alasan oleh CS.
        </p>
      </section>

      <footer className="border-t border-line pt-3 text-[11px] text-ink-400">
        Laporan otomatis Labbaika Reporting · angka mengikuti mode atribusi default dashboard.
      </footer>
    </div>
  );
}

export default function AnalisaReportPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-ink-400">Menyusun laporan…</p>}>
      <AnalisaReport />
    </Suspense>
  );
}
