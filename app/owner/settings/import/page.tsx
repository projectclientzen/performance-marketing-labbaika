"use client";

import { useState, useRef } from "react";
import { apiFetch } from "@/lib/api/client";
import { Banner } from "@/components/ui/Banner";

/**
 * F-16 Ads data import. The prototype (docs/labbaika-reporting.html) has a
 * file drop zone plus a column-mapping table (csv header → internal
 * field) instead of a raw-CSV textarea — this rebuilds that. The mapping
 * happens entirely client-side; POST /api/ads/import still receives the
 * same pre-normalized row shape it always has (external_id/name/date/
 * spend/impressions/reach/clicks/leads), so no backend change was needed
 * for this. `external_id` has no natural column in a raw Meta export (no
 * stable numeric campaign ID in the minimal column set the mapping table
 * exposes), so it's derived from the mapped campaign name — same identity
 * key the simplified flow already relied on before this rewrite.
 */

const MAPPABLE_FIELDS = [
  { key: "name", label: "Campaign", guesses: ["campaign name", "campaign"] },
  { key: "spend", label: "Spend", guesses: ["amount spent", "spend"] },
  { key: "leads", label: "Lead", guesses: ["results", "leads"] },
  { key: "date", label: "Tanggal", guesses: ["reporting starts", "date", "day"] },
] as const;
type MappableKey = (typeof MAPPABLE_FIELDS)[number]["key"];

function guessColumn(headers: string[], guesses: readonly string[]): string {
  const lower = headers.map((h) => h.toLowerCase());
  for (const g of guesses) {
    const i = lower.findIndex((h) => h.includes(g));
    if (i >= 0) return headers[i];
  }
  return "";
}

function slugify(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function parseCsvRows(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(",").map((h) => h.trim());
  const rows = lines.slice(1).map((line) => line.split(",").map((c) => c.trim()));
  return { headers, rows };
}

export default function AdsImportPage() {
  const [level, setLevel] = useState<"account" | "campaign" | "adset" | "ad">("campaign");
  const [accountExternalId, setAccountExternalId] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<MappableKey, string>>({
    name: "",
    spend: "",
    leads: "",
    date: "",
  });
  const [result, setResult] = useState<{ imported: number; errors: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function loadFile(file: File) {
    setResult(null);
    setError(null);
    file.text().then((text) => {
      const { headers: h, rows } = parseCsvRows(text);
      setFileName(file.name);
      setHeaders(h);
      setCsvRows(rows);
      setMapping({
        name: guessColumn(h, MAPPABLE_FIELDS[0].guesses),
        spend: guessColumn(h, MAPPABLE_FIELDS[1].guesses),
        leads: guessColumn(h, MAPPABLE_FIELDS[2].guesses),
        date: guessColumn(h, MAPPABLE_FIELDS[3].guesses),
      });
    });
  }

  function mappedRows() {
    return csvRows.map((cells) => {
      const get = (col: string) => (col ? cells[headers.indexOf(col)] ?? "" : "");
      const name = get(mapping.name);
      return {
        external_id: slugify(name),
        name: name || undefined,
        date: get(mapping.date),
        spend: Number(get(mapping.spend)) || 0,
        impressions: 0,
        reach: 0,
        clicks: 0,
        leads: Number(get(mapping.leads)) || 0,
      };
    });
  }

  async function handleImport() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const rows = mappedRows();
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

  const previewRows = mappedRows().slice(0, 5);
  const canImport = fileName !== null && mapping.name && mapping.date && !loading;

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
        <div className="flex flex-wrap gap-2">
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
              className="h-10 flex-1 rounded-lg border border-line px-3 text-sm"
            />
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) loadFile(f);
          }}
        />

        {!fileName ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) loadFile(f);
            }}
            className={`flex h-32 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed text-sm text-ink-400 ${
              dragOver ? "border-brass bg-brass-lo" : "border-line"
            }`}
          >
            <span className="text-xl">⇪</span>
            <span className="mt-1">Tarik file CSV ke sini atau klik untuk pilih</span>
          </div>
        ) : (
          <div className="rounded-lg border border-line p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium text-ink-900">⇪ {fileName}</span>
              <button
                type="button"
                onClick={() => {
                  setFileName(null);
                  setHeaders([]);
                  setCsvRows([]);
                  setResult(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="text-xs text-blue underline"
              >
                Ganti file
              </button>
            </div>
            <p className="mt-1 text-xs text-ink-400">
              {csvRows.length} baris terbaca · {mapping.name && mapping.date ? "siap dipetakan" : "lengkapi pemetaan kolom"}
            </p>
          </div>
        )}

        {fileName && (
          <>
            <div>
              <p className="mb-2 text-xs font-medium text-ink-600">Pemetaan kolom</p>
              <div className="space-y-2">
                {MAPPABLE_FIELDS.map((f) => (
                  <div key={f.key} className="flex items-center gap-2 text-sm">
                    <select
                      value={mapping[f.key]}
                      onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value }))}
                      className="h-9 flex-1 rounded-lg border border-line px-2 text-sm"
                    >
                      <option value="">— tidak dipakai</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                    <span className="text-ink-400">→</span>
                    <span className="w-20 shrink-0 font-medium text-ink-900">{f.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {previewRows.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium text-ink-600">Preview</p>
                <div className="overflow-x-auto rounded-lg border border-line">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-line text-left text-ink-600">
                        <th className="p-2">Campaign</th>
                        <th className="p-2 text-right">Spend</th>
                        <th className="p-2 text-right">Lead</th>
                        <th className="p-2 text-right">Tanggal</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      {previewRows.map((r, i) => (
                        <tr key={i} className="border-b border-line last:border-0">
                          <td className="p-2 font-sans">{r.name ?? "-"}</td>
                          <td className="p-2 text-right">{r.spend}</td>
                          <td className="p-2 text-right">{r.leads}</td>
                          <td className="p-2 text-right">{r.date || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleImport}
              disabled={!canImport}
              className="h-11 w-full rounded-lg bg-brass text-sm font-semibold text-on-brass disabled:opacity-50"
            >
              {loading ? "Mengimpor..." : `Impor ${csvRows.length} baris`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
