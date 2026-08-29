"use client";

import { useEffect, useState } from "react";
import { NumberStepper } from "@/components/ui/NumberStepper";
import { apiFetch } from "@/lib/api/client";

interface InsightCategory {
  id: string;
  name: string;
}

export interface InsightSheetProps {
  open: boolean;
  onClose: () => void;
  leadReportId: string;
  stageCounts: { consultation: number; offering: number };
  /** Posisi dalam antrean multi-source (mis. 2 dari 3), opsional. */
  step?: number;
  total?: number;
}

type Stage = "consultation" | "offering";

/**
 * F-04 — Insight sheet (wajib).
 * Centered modal, scrollable. Buttons always visible at bottom.
 * Replace-all per stage.
 */
export function InsightSheet({
  open,
  onClose,
  leadReportId,
  stageCounts,
  step,
  total,
}: InsightSheetProps) {
  const [categories, setCategories] = useState<InsightCategory[]>([]);
  const [tab, setTab] = useState<Stage>("offering");
  const [counts, setCounts] = useState<Record<Stage, Record<string, number>>>({
    consultation: {},
    offering: {},
  });
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open)
      apiFetch<InsightCategory[]>("/api/master/insight-categories").then(
        setCategories,
      );
  }, [open]);

  const filledStage = (stage: Stage) => Object.values(counts[stage]).reduce((a, b) => a + b, 0);
  const filled = filledStage(tab);
  const stageTotal = stageCounts[tab];
  // Wajib penuh: tiap lead yang tidak lanjut di sebuah stage harus punya
  // alasan. Selesai kalau jumlah alasan == jumlah lead di stage itu. Lebih
  // besar (over-attribusi) juga belum boleh simpan.
  const completeConsult = filledStage("consultation") === stageCounts.consultation;
  const completeOffering = filledStage("offering") === stageCounts.offering;
  const allComplete = completeConsult && completeOffering;
  const tabComplete: Record<Stage, boolean> = {
    consultation: completeConsult,
    offering: completeOffering,
  };

  function setCount(categoryId: string, value: number) {
    setCounts((prev) => ({
      ...prev,
      [tab]: { ...prev[tab], [categoryId]: value },
    }));
  }

  async function handleSave() {
    setSaving(true);
    const insights = (["consultation", "offering"] as Stage[]).flatMap(
      (stage) =>
        Object.entries(counts[stage])
          .filter(([, count]) => count > 0)
          .map(([category_id, lead_count]) => ({
            stage,
            category_id,
            lead_count,
            note: note || undefined,
          })),
    );
    try {
      await apiFetch(`/api/lead-reports/${leadReportId}/insights`, {
        method: "PUT",
        body: JSON.stringify({
          stages: ["consultation", "offering"],
          insights,
        }),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop TIDAK menutup sheet: pengisian alasan wajib (keputusan
          owner). Satu-satunya jalan keluar adalah menyelesaikan semua alasan
          lalu "Simpan insight". */}
      <div className="absolute inset-0 bg-scrim" />
      <div className="relative mx-4 flex max-h-[80vh] w-full max-w-[420px] flex-col overflow-hidden rounded-2xl bg-paper shadow-xl">
        {/* header */}
        <div className="shrink-0 px-5 pt-5 pb-3">
          <h2 className="font-display text-lg font-semibold text-ink-900">
            Tambah insight
            {total && total > 1 ? (
              <span className="ml-2 text-sm font-normal text-ink-400">sumber {step} dari {total}</span>
            ) : null}
          </h2>
          <p className="mt-0.5 text-[13px] text-warn-ink">
            Wajib: beri alasan untuk setiap lead yang tidak lanjut. Isi kedua tab
            sampai lengkap sebelum bisa disimpan.
          </p>
          {/* tabs */}
          <div className="mt-3 flex gap-1 rounded-full border border-line bg-card p-1">
            {(["consultation", "offering"] as Stage[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setTab(s)}
                className={
                  tab === s
                    ? "h-[36px] flex-1 rounded-full bg-navy-900 text-sm font-medium text-white"
                    : "h-[36px] flex-1 rounded-full text-sm font-medium text-ink-600"
                }
              >
                {s === "consultation" ? "Consultation" : "Offering"}
                {stageCounts[s] > 0 && (
                  <span className="ml-1.5">
                    {tabComplete[s] ? "✓" : `${filledStage(s)}/${stageCounts[s]}`}
                  </span>
                )}
              </button>
            ))}
          </div>
          <p className={`mt-2 text-[13px] ${tabComplete[tab] ? "text-ok" : "text-warn-ink"}`}>
            {filled} dari {stageTotal} lead {tab} sudah diberi alasan
            {filled > stageTotal ? " — melebihi jumlah lead, kurangi dulu" : ""}
          </p>
        </div>
        {/* scrollable body */}
        <div className="flex-1 space-y-2.5 overflow-y-auto px-5 pb-4">
          {categories.map((cat) => (
            <NumberStepper
              key={cat.id}
              label={cat.name}
              value={counts[tab][cat.id] ?? 0}
              onChange={(v) => setCount(cat.id, v)}
              min={0}
            />
          ))}
          <textarea
            placeholder="Catatan bebas (opsional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="mt-2 h-14 w-full rounded-lg border border-line px-3 py-2 text-sm"
          />
        </div>
        {/* buttons fixed bottom */}
        <div className="shrink-0 flex gap-3 border-t border-line px-5 py-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !allComplete}
            className="h-[46px] flex-1 rounded-lg bg-brass text-[15px] font-semibold text-on-brass disabled:opacity-50"
          >
            {saving
              ? "Menyimpan..."
              : allComplete
                ? "Simpan insight"
                : !completeOffering
                  ? "Lengkapi tab Offering"
                  : "Lengkapi tab Consultation"}
          </button>
        </div>
      </div>
    </div>
  );
}
