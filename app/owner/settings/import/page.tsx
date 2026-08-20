"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api/client";
import { Banner } from "@/components/ui/Banner";

/**
 * F-16 Ads data import. Simplified: paste/upload CSV text, parsed
 * client-side, sent as structured rows to POST /api/ads/import — no
 * server-side multipart parsing or a real column-mapping UI.
 * Expected header: external_id,name,date,spend,impressions,reach,clicks,leads
 */
export default function AdsImportPage() {
  const [level, setLevel] = useState<"account" | "campaign" | "adset" | "ad">("campaign");
  const [accountExternalId, setAccountExternalId] = useState("");
  const [csvText, setCsvText] = useState("");
  const [result, setResult] = useState<{ imported: number; errors: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function parseCsv(text: string) {
    const lines = text.trim().split(/\r?\n/);
    const headers = lines[0].split(",").map((h) => h.trim());
    return lines.slice(1).map((line) => {
      const cells = line.split(",").map((c) => c.trim());
      const row: Record<string, string> = {};
      headers.forEach((h, i) => (row[h] = cells[i]));
      return {
        external_id: row.external_id,
        name: row.name || undefined,
        date: row.date,
        spend: Number(row.spend) || 0,
        impressions: Number(row.impressions) || 0,
        reach: Number(row.reach) || 0,
        clicks: Number(row.clicks) || 0,
        leads: Number(row.leads) || 0,
      };
    });
  }

  async function handleImport() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const rows = parseCsv(csvText);
      const data = await apiFetch<{ imported: number; errors: string[] }>("/api/ads/import", {
        method: "POST",
        body: JSON.stringify({
          level,
          ad_account_external_id: accountExternalId || undefined,
          rows,
        }),
      });
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal import");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-bold text-ink-900">Ads data import</h1>
      {error && <Banner variant="danger">{error}</Banner>}
      {result && (
        <Banner variant={result.errors.length > 0 ? "warn" : "ok"}>
          {result.imported} baris berhasil diimpor. {result.errors.length > 0 && `${result.errors.length} gagal.`}
        </Banner>
      )}

      <div className="space-y-3 rounded-[10px] border border-line bg-card p-4">
        <select value={level} onChange={(e) => setLevel(e.target.value as typeof level)} className="h-10 rounded-lg border border-line px-2 text-sm">
          <option value="account">Account</option>
          <option value="campaign">Campaign</option>
          <option value="adset">Ad Set</option>
          <option value="ad">Ad</option>
        </select>
        {level === "campaign" && (
          <input
            placeholder="Ad account external_id (opsional)"
            value={accountExternalId}
            onChange={(e) => setAccountExternalId(e.target.value)}
            className="h-10 w-full rounded-lg border border-line px-3 text-sm"
          />
        )}
        <textarea
          placeholder="external_id,name,date,spend,impressions,reach,clicks,leads"
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          className="h-40 w-full rounded-lg border border-line p-3 font-mono text-xs"
        />
        <button
          type="button"
          onClick={handleImport}
          disabled={loading || !csvText}
          className="h-11 w-full rounded-lg bg-brass text-sm font-semibold text-on-brass disabled:opacity-50"
        >
          {loading ? "Mengimpor..." : "Import"}
        </button>
      </div>
    </div>
  );
}
