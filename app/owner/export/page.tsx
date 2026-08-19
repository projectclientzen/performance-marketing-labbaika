"use client";

import { useState } from "react";
import { todayJakarta } from "@/lib/utils/date";
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

export default function ExportCenterPage() {
  const [from, setFrom] = useState(`${todayJakarta().slice(0, 7)}-01`);
  const [to, setTo] = useState(todayJakarta());
  const [error, setError] = useState<string | null>(null);
  const [loadingOp, setLoadingOp] = useState(false);
  const [loadingMeta, setLoadingMeta] = useState(false);

  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-bold text-ink-900">Export Center</h1>
      {error && <Banner variant="danger">{error}</Banner>}

      <div className="flex gap-2 rounded-[10px] border border-line bg-card p-3">
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10 rounded-lg border border-line px-2 text-sm" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-10 rounded-lg border border-line px-2 text-sm" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
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
            className="mt-3 h-10 w-full rounded-lg border border-line text-sm font-medium text-ink-900 disabled:opacity-50"
          >
            {loadingMeta ? "Mengunduh..." : "Unduh CSV"}
          </button>
        </div>
      </div>
    </div>
  );
}
