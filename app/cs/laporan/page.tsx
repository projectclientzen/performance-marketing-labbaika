"use client";
import { uuid } from "@/lib/utils/uuid";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  closing: number;
}

interface LeadReport {
  id: string;
  report_date: string;
  source_id: string;
  total_lead: number;
  cold: number;
  consultation: number;
  offering: number;
  closing: number;
}

interface PastReport {
  id: string;
  report_date: string;
  total_lead: number;
  cold: number;
  consultation: number;
  offering: number;
  closing: number | null;
  lead_source?: { name: string };
}

function emptyBlock(sourceId: string): Block {
  return { source_id: sourceId, total_lead: 0, cold: 0, consultation: 0, offering: 0, closing: 0 };
}

export default function LaporanHarianPage() {
  return (
    <Suspense>
      <LaporanHarianForm />
    </Suspense>
  );
}

function LaporanHarianForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [date, setDate] = useState(todayJakarta());
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(!!editId);
  const [idempotencyKey, setIdempotencyKey] = useState(() => uuid());
  // Antre semua source yang punya lead consultation/offering — tiap satu wajib
  // diberi alasan (wajib penuh). Bukan cuma source terbesar: kalau tidak, lead
  // offering source lain lolos tanpa alasan dan data Lead Intel tetap bolong.
  const [insightQueue, setInsightQueue] = useState<
    { id: string; consultation: number; offering: number }[]
  >([]);
  const [insightTotal, setInsightTotal] = useState(0);
  const [pastReports, setPastReports] = useState<PastReport[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<LeadSource[]>("/api/master/sources").then((data) => {
      setSources(data);
      if (!editId && data.length > 0) setBlocks([emptyBlock(data[0].id)]);
    });
  }, [editId]);

  // Fetch past reports for edit/delete
  useEffect(() => {
    const today = todayJakarta();
    const monthStart = today.slice(0, 7) + "-01";
    apiFetch<PastReport[]>(`/api/lead-reports?from=${monthStart}&to=${today}`)
      .then((data) => setPastReports(data.filter((r) => !editId || r.id !== editId)))
      .catch(() => {});
  }, [editId, saved]);

  useEffect(() => {
    if (!editId) return;
    apiFetch<LeadReport>(`/api/lead-reports/${editId}`)
      .then((r) => {
        setDate(r.report_date);
        setBlocks([
          {
            source_id: r.source_id,
            total_lead: r.total_lead,
            cold: r.cold,
            consultation: r.consultation,
            offering: r.offering,
            closing: r.closing ?? 0,
          },
        ]);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat laporan"))
      .finally(() => setLoadingEdit(false));
  }, [editId]);

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
    if (editId) {
      try {
        const block = blocks[0];
        await apiFetch(`/api/lead-reports/${editId}`, {
          method: "PATCH",
          body: JSON.stringify({
            total_lead: block.total_lead,
            cold: block.cold,
            consultation: block.consultation,
            offering: block.offering,
          }),
        });
        setSaved(true);
        // Koreksi juga wajib alasan: kalau laporan ini punya lead consultation/
        // offering, buka sheet insight (pre-loaded) sebelum keluar.
        if (editId && block.consultation + block.offering > 0) {
          setInsightQueue([{ id: editId, consultation: block.consultation, offering: block.offering }]);
          setInsightTotal(1);
        } else {
          setTimeout(() => router.push("/cs"), 800);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Gagal menyimpan koreksi");
      } finally {
        setSubmitting(false);
      }
      return;
    }
    try {
      const savedReports = await apiFetch<
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
      setIdempotencyKey(uuid());
      const needing = savedReports.filter((r) => r.consultation + r.offering > 0);
      if (needing.length > 0) {
        setInsightQueue(needing);
        setInsightTotal(needing.length);
      } else {
        setTimeout(() => router.push("/cs"), 1200);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Laporan tersimpan di perangkat. Akan terkirim saat online.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Hapus laporan ini?")) return;
    setDeleting(id);
    try {
      await apiFetch(`/api/lead-reports/${id}`, { method: "DELETE" });
      setPastReports((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menghapus");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="pb-24">
      <header className="flex items-center gap-3 border-b border-line bg-card px-[18px] py-3.5">
        <button type="button" onClick={() => router.push("/cs")} aria-label="Kembali" className="text-[22px] text-ink-600">
          ‹
        </button>
        <h1 className="flex-1 font-display text-[17px] font-semibold text-ink-900">
          {editId ? "Koreksi laporan" : "Laporan harian"}
        </h1>
        <input
          type="date"
          value={date}
          max={todayJakarta()}
          disabled={!!editId}
          onChange={(e) => setDate(e.target.value)}
          className="h-9 rounded-lg border border-line bg-paper px-2 text-[13px] disabled:opacity-60"
        />
      </header>

      <div className="space-y-4 p-4 lg:pb-28">
        {error && <Banner variant="warn">{error}</Banner>}
        {saved && <Banner variant="ok">{editId ? "Koreksi tersimpan" : "Laporan tersimpan"}</Banner>}
        {!editId && sources.length === 0 && (
          <Banner variant="warn">
            Belum ada sumber lead yang bisa dipilih. Minta owner menambahkan sumber lead dulu.
          </Banner>
        )}
        {loadingEdit && <p className="text-sm text-ink-400">Memuat laporan...</p>}

        {/* Laporan sebelumnya — edit/delete */}
        {pastReports.length > 0 && !editId && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-ink-600">Laporan bulan ini</h2>
            {pastReports.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-lg border border-line bg-card px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-ink-900">
                    {r.lead_source?.name ?? "—"} · {r.report_date}
                  </p>
                  <p className="text-[12px] text-ink-400">
                    {r.total_lead} lead · {r.closing ?? 0} closing
                  </p>
                </div>
                <div className="ml-2 flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => router.push(`/cs/laporan?id=${r.id}`)}
                    className="h-8 rounded-md border border-line px-3 text-[12px] font-medium text-ink-600"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(r.id)}
                    disabled={deleting === r.id}
                    className="h-8 rounded-md border border-danger/30 px-3 text-[12px] font-medium text-danger disabled:opacity-50"
                  >
                    {deleting === r.id ? "..." : "Hapus"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Desktop (prototype F-03): kartu source berjajar 2 kolom */}
        <div className="space-y-4 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
          {!loadingEdit && blocks.map((block, i) => {
            return (
              <div key={i} className="rounded-[10px] border border-line bg-card p-4">
                <div className="mb-3 flex items-center justify-between">
                  <select
                    value={block.source_id}
                    disabled={!!editId}
                    onChange={(e) => updateBlock(i, { source_id: e.target.value })}
                    className="h-10 rounded-lg border border-line px-2 text-sm font-semibold disabled:opacity-60"
                  >
                    {sources.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  {!editId && blocks.length > 1 && (
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
                  <div className="flex items-center justify-between rounded-lg bg-paper px-3 py-2.5">
                    <span className="flex items-center gap-1.5 text-sm font-medium text-ink-600">
                      Closing
                      <span
                        aria-hidden
                        title="Dihitung otomatis dari closing yang kamu catat"
                        className="flex h-4 w-4 items-center justify-center rounded-full bg-line text-[10px] text-ink-600"
                      >
                        i
                      </span>
                    </span>
                    <span className="font-mono text-sm text-ink-900">{block.closing}</span>
                  </div>
                </div>

                <div className="mt-3">
                  <StageRail
                    size="medium"
                    withNumbers
                    segments={[
                      { stage: "cold", value: block.cold },
                      { stage: "consultation", value: block.consultation },
                      { stage: "offering", value: block.offering },
                      { stage: "closing", value: block.closing },
                    ]}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {!editId && sources.length > 0 && (
          <button
            type="button"
            onClick={addBlock}
            disabled={blocks.length >= sources.length}
            className="h-[46px] w-full rounded-lg border border-dashed border-ink-400 text-[15px] font-medium text-ink-600 disabled:opacity-50"
          >
            {blocks.length >= sources.length ? "Semua sumber sudah ditambahkan" : "+ Tambah source"}
          </button>
        )}
      </div>

      <div className="fixed bottom-16 left-0 right-0 z-20 border-t border-line bg-card px-[18px] py-3.5 shadow-lg lg:bottom-0 lg:left-[220px]">
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
              blocks.some((b) => b.total_lead - (b.cold + b.consultation + b.offering + b.closing) !== 0)
            }
            className="h-[50px] rounded-lg bg-brass px-[22px] text-base font-semibold text-on-brass disabled:opacity-50"
          >
            {submitting ? "Menyimpan..." : editId ? "Simpan koreksi" : "Simpan laporan"}
          </button>
        </div>
      </div>

      {insightQueue.length > 0 && (
        <InsightSheet
          key={insightQueue[0].id}
          open
          step={insightTotal - insightQueue.length + 1}
          total={insightTotal}
          onClose={() => {
            setInsightQueue((q) => {
              const rest = q.slice(1);
              if (rest.length === 0) router.push("/cs");
              return rest;
            });
          }}
          leadReportId={insightQueue[0].id}
          stageCounts={{ consultation: insightQueue[0].consultation, offering: insightQueue[0].offering }}
        />
      )}
    </div>
  );
}
