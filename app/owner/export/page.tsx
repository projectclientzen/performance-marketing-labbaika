"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDateID, monthRange, todayJakarta } from "@/lib/utils/date";
import { apiFetch } from "@/lib/api/client";
import { Banner } from "@/components/ui/Banner";

async function downloadExport(endpoint: string, from: string, to: string, filename: string) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from, to }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? "Gagal mengunduh export");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type Preset = "this-month" | "last-month" | "custom";

export default function ExportCenterPage() {
  const [from, setFrom] = useState(`${todayJakarta().slice(0, 7)}-01`);
  const [to, setTo] = useState(todayJakarta());
  const [preset, setPreset] = useState<Preset>("this-month");

  function applyPreset(next: Preset) {
    setPreset(next);
    if (next === "this-month") {
      setFrom(`${todayJakarta().slice(0, 7)}-01`);
      setTo(todayJakarta());
    } else if (next === "last-month") {
      const [y, m] = todayJakarta().split("-").map(Number);
      const prev = new Date(y, m - 2, 1);
      const range = monthRange(prev.getFullYear(), prev.getMonth() + 1);
      setFrom(range.from);
      setTo(range.to);
    }
  }

  const [error, setError] = useState<string | null>(null);
  const [loadingOp, setLoadingOp] = useState(false);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [loadingGass, setLoadingGass] = useState(false);
  const [copied, setCopied] = useState<{ rows: number; missing: number } | null>(null);

  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-bold text-ink-900">Export Center</h1>
      {error && <Banner variant="danger">{error}</Banner>}

      {/* Preset rentang (prototype F-13: "1–19 Agu", "Juli 2026", "Kustom…").
          Input tanggal mentah hanya muncul saat preset "Kustom". */}
      <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-line bg-card p-3">
        <select
          value={preset}
          onChange={(e) => applyPreset(e.target.value as Preset)}
          className="h-10 rounded-lg border border-line px-2 text-sm text-ink-900"
        >
          <option value="this-month">Bulan ini</option>
          <option value="last-month">Bulan lalu</option>
          <option value="custom">Kustom…</option>
        </select>
        {preset === "custom" ? (
          <>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10 rounded-lg border border-line px-2 text-sm" />
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-10 rounded-lg border border-line px-2 text-sm" />
          </>
        ) : (
          <span className="font-mono text-[13px] text-ink-600">
            {formatDateID(from)} – {formatDateID(to)}
          </span>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[10px] border border-line bg-card p-4">
          <h2 className="font-display font-semibold text-ink-900">Operational CSV</h2>
          <p className="mt-1 text-xs text-ink-400">Data closing lengkap untuk periode terpilih.</p>
          <button
            type="button"
            disabled={loadingOp}
            onClick={async () => {
              setLoadingOp(true);
              setError(null);
              try {
                await downloadExport("/api/exports/operational", from, to, `operational-${from}-${to}.csv`);
              } catch (e) {
                setError(e instanceof Error ? e.message : "Gagal export");
              } finally {
                setLoadingOp(false);
              }
            }}
            className="mt-3 h-10 w-full rounded-lg border border-line text-sm font-medium text-ink-900 disabled:opacity-50"
          >
            {loadingOp ? "Mengunduh..." : "Unduh CSV"}
          </button>
        </div>

        <div className="rounded-[10px] border border-line bg-card p-4">
          <h2 className="font-display font-semibold text-ink-900">Meta LTV CSV</h2>
          <p className="mt-1 text-xs text-ink-400">
            Hanya closing dengan PDP consent, nomor dan nama sudah di-hash SHA-256.
          </p>
          <button
            type="button"
            disabled={loadingMeta}
            onClick={async () => {
              setLoadingMeta(true);
              setError(null);
              try {
                await downloadExport("/api/exports/meta-ltv", from, to, `meta-ltv-${from}-${to}.csv`);
              } catch (e) {
                setError(e instanceof Error ? e.message : "Gagal export");
              } finally {
                setLoadingMeta(false);
              }
            }}
            className="mt-3 h-10 w-full rounded-lg bg-brass text-sm font-semibold text-on-brass disabled:opacity-50"
          >
            {loadingMeta ? "Mengunduh..." : "Unduh CSV"}
          </button>
        </div>

        <div className="rounded-[10px] border border-line bg-card p-4">
          <h2 className="font-display font-semibold text-ink-900">Export Gass Apps</h2>
          <p className="mt-1 text-xs text-ink-400">
            Format Purchase — ID, Phone Number, CS Phone Number, Value. Disalin ke clipboard, tidak diunduh.
          </p>
          <button
            type="button"
            disabled={loadingGass}
            onClick={async () => {
              setLoadingGass(true);
              setError(null);
              setCopied(null);
              try {
                const result = await apiFetch<{ csv: string; row_count: number; missing_cs_phone: number }>(
                  "/api/exports/gass-apps",
                  { method: "POST", body: JSON.stringify({ from, to }) },
                );
                await navigator.clipboard.writeText(result.csv);
                setCopied({ rows: result.row_count, missing: result.missing_cs_phone });
              } catch (e) {
                setError(e instanceof Error ? e.message : "Gagal export");
              } finally {
                setLoadingGass(false);
              }
            }}
            className="mt-3 h-10 w-full rounded-lg bg-navy-900 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loadingGass ? "Menyalin..." : "Salin ke clipboard"}
          </button>
          {copied && (
            <p className="mt-2 text-xs text-ink-600">
              {copied.rows} baris disalin.
              {copied.missing > 0 && ` ${copied.missing} baris belum punya nomor WA CS — isi lewat Manajemen user.`}
            </p>
          )}
        </div>
      </div>

      {/* Laporan analisa gabungan — dibuka di tab baru, disimpan sebagai PDF
          lewat dialog cetak (tanpa dependency PDF di server). */}
      <div className="rounded-[10px] border border-line bg-card p-4">
        <h2 className="font-display font-semibold text-ink-900">Analisa Detail (PDF)</h2>
        <p className="mt-1 text-xs text-ink-400">
          Laporan gabungan: ringkasan eksekutif, corong lead, biaya per lead (CPL real / konsultasi /
          potensial) dan CPP, kualitas lead per campaign, serta alasan lead belum closing. Buka lalu
          simpan sebagai PDF.
        </p>
        <Link
          href={`/owner/export/analisa?from=${from}&to=${to}`}
          target="_blank"
          className="mt-3 inline-flex h-10 items-center justify-center rounded-lg bg-brass px-4 text-sm font-semibold text-on-brass"
        >
          Buka laporan analisa
        </Link>
      </div>
    </div>
  );
}
