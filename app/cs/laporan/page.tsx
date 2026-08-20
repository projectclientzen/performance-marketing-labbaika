"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api/client";
import { todayJakarta } from "@/lib/utils/date";
import { NumberStepper } from "@/components/ui/NumberStepper";
import { StageRail } from "@/components/ui/StageRail";
import { Banner } from "@/components/ui/Banner";
import { InsightSheet } from "@/components/InsightSheet";

interface LeadSource {
  id: string;
  name: string;
}

interface Block {
  source_id: string;
  total_lead: number;
  cold: number;
  consultation: number;
  offering: number;
}

function emptyBlock(sourceId: string): Block {
  return { source_id: sourceId, total_lead: 0, cold: 0, consultation: 0, offering: 0 };
}

export default function LaporanHarianPage() {
  const router = useRouter();
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [date, setDate] = useState(todayJakarta());
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  // S1-03: idempotency key dibuat SEKALI per pengisian form (bukan per klik),
  // supaya klik ganda / retry kirim key yang sama dan tidak lolos cek duplikat.
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [insightTarget, setInsightTarget] = useState<{
    id: string;
    consultation: number;
    offering: number;
  } | null>(null);

  useEffect(() => {
    apiFetch<LeadSource[]>("/api/master/sources").then((data) => {
      setSources(data);
      if (data.length > 0) setBlocks([emptyBlock(data[0].id)]);
    });
  }, []);

  function updateBlock(index: number, patch: Partial<Block>) {
    setBlocks((prev) => prev.map((b, i) => (i === index ? { ...b, ...patch } : b)));
  }

  function addBlock() {
    if (sources.length === 0) return;
    const usedSourceIds = new Set(blocks.map((b) => b.source_id));
    const nextSource = sources.find((s) => !usedSourceIds.has(s.id)) ?? sources[0];
    setBlocks((prev) => [...prev, emptyBlock(nextSource.id)]);
  }

  function removeBlock(index: number) {
    setBlocks((prev) => prev.filter((_, i) => i !== index));
  }

  const grandTotal = blocks.reduce((sum, b) => sum + b.total_lead, 0);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const saved = await apiFetch<
        { id: string; consultation: number; offering: number }[]
      >("/api/lead-reports", {
        method: "POST",
        body: JSON.stringify({
          date,
          blocks,
          idempotency_key: idempotencyKey,
        }),
      });
      setSaved(true);
      // Key lama sudah terpakai — buat baru untuk pengisian berikutnya.
      setIdempotencyKey(crypto.randomUUID());
      // Insight sheet targets the block with the most consultation+offering
      // lead — showing one sheet per block would be more correct for
      // multi-source days, but adds real complexity for a rare case.
      // reduce with no initial value throws on an empty array — the batch
      // RPC can return zero rows (idempotency conflict landed on
      // on-conflict-do-nothing), which would otherwise crash this page
      // after the save already succeeded (10-AUDIT-FE-BE.md #8).
      const primary = saved.length > 0
        ? saved.reduce((best, r) =>
            r.consultation + r.offering > best.consultation + best.offering ? r : best,
          )
        : null;
      if (primary && primary.consultation + primary.offering > 0) {
        setInsightTarget(primary);
      } else {
        setTimeout(() => router.push("/cs"), 1200);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Laporan tersimpan di perangkat. Akan terkirim saat online.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="pb-24">
      <header className="flex items-center gap-3 border-b border-line bg-card px-[18px] py-3.5">
        <button type="button" onClick={() => router.push("/cs")} aria-label="Kembali" className="text-[22px] text-ink-600">
          ‹
        </button>
        <h1 className="flex-1 font-display text-[17px] font-semibold text-ink-900">Laporan harian</h1>
        <input
          type="date"
          value={date}
          max={todayJakarta()}
          onChange={(e) => setDate(e.target.value)}
          className="h-9 rounded-lg border border-line bg-paper px-2 text-[13px]"
        />
      </header>

      <div className="space-y-4 p-4">
        {error && <Banner variant="warn">{error}</Banner>}
        {saved && <Banner variant="ok">Laporan tersimpan</Banner>}

        <div className="space-y-4">
          {blocks.map((block, i) => {
            const sisa = block.total_lead - (block.cold + block.consultation + block.offering);
            return (
              <div key={i} className="rounded-[10px] border border-line bg-card p-4">
                <div className="mb-3 flex items-center justify-between">
                  <select
                    value={block.source_id}
                    onChange={(e) => updateBlock(i, { source_id: e.target.value })}
                    className="h-10 rounded-lg border border-line px-2 text-sm font-semibold"
                  >
                    {sources.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  {blocks.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeBlock(i)}
                      className="text-xs text-danger"
                    >
                      Hapus
                    </button>
                  )}
                </div>

                <div className="space-y-2.5">
                  <NumberStepper
                    label="Total Lead"
                    value={block.total_lead}
                    onChange={(v) => updateBlock(i, { total_lead: v })}
                  />
                  <NumberStepper
                    label="Cold"
                    value={block.cold}
                    onChange={(v) => updateBlock(i, { cold: v })}
                  />
                  <NumberStepper
                    label="Consultation"
                    value={block.consultation}
                    onChange={(v) => updateBlock(i, { consultation: v })}
                  />
                  <NumberStepper
                    label="Offering"
                    value={block.offering}
                    onChange={(v) => updateBlock(i, { offering: v })}
                  />
                </div>

                <div className="mt-3">
                  <StageRail
                    size="medium"
                    withNumbers
                    segments={[
                      { stage: "cold", value: block.cold },
                      { stage: "consultation", value: block.consultation },
                      { stage: "offering", value: block.offering },
                    ]}
                  />
                  <div
                    className={`mt-3 flex items-center gap-1.5 text-[13px] ${sisa === 0 ? "text-ok" : "text-warn-ink"}`}
                  >
                    <span className={`h-[7px] w-[7px] rounded-full ${sisa === 0 ? "bg-ok" : "bg-warn"}`} />
                    {sisa === 0 ? "Semua lead sudah dikategorikan" : `Sisa belum dikategorikan: ${sisa}`}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={addBlock}
          className="h-[46px] w-full rounded-lg border border-dashed border-ink-400 text-[15px] font-medium text-ink-600"
        >
          + Tambah source
        </button>
      </div>

      <div className="fixed bottom-16 left-0 right-0 border-t border-line bg-card px-[18px] py-3.5 shadow-lg">
        <div className="mx-auto flex max-w-lg items-center gap-3.5">
          <div className="flex-1">
            <p className="text-[11px] text-ink-400">Total lead</p>
            <p className="font-mono text-xl font-semibold text-ink-900">{grandTotal}</p>
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={
              submitting ||
              blocks.length === 0 ||
              blocks.some((b) => b.total_lead - (b.cold + b.consultation + b.offering) !== 0)
            }
            className="h-[50px] rounded-lg bg-brass px-[22px] text-base font-semibold text-on-brass disabled:opacity-50"
          >
            {submitting ? "Menyimpan..." : "Simpan laporan"}
          </button>
        </div>
      </div>

      {insightTarget && (
        <InsightSheet
          open
          onClose={() => {
            setInsightTarget(null);
            router.push("/cs");
          }}
          leadReportId={insightTarget.id}
          stageCounts={{ consultation: insightTarget.consultation, offering: insightTarget.offering }}
        />
      )}
    </div>
  );
}
