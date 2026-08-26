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

  const filled = Object.values(counts[tab]).reduce((s, n) => s + n, 0);
  const stageTotal = stageCounts[tab];

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
      <button
        type="button"
        aria-label="Tutup"
        onClick={onClose}
        className="absolute inset-0 bg-scrim"
      />
      <div className="relative mx-4 flex max-h-[80vh] w-full max-w-[420px] flex-col overflow-hidden rounded-2xl bg-paper shadow-xl">
        {/* header */}
        <div className="shrink-0 px-5 pt-5 pb-3">
          <h2 className="font-display text-lg font-semibold text-ink-900">
            Tambah insight
          </h2>
          <p className="mt-0.5 text-[13px] text-ink-400">
            Wajib diisi sebelum tutup
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
              </button>
            ))}
          </div>
          <p className="mt-2 text-[13px] text-ink-600">
            {filled} dari {stageTotal} lead {tab} sudah diberi insight
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
            disabled={saving}
            className="h-[46px] flex-1 rounded-lg bg-brass text-[15px] font-semibold text-on-brass disabled:opacity-50"
          >
            {saving ? "Menyimpan..." : "Simpan insight"}
          </button>
        </div>
      </div>
    </div>
  );
}
