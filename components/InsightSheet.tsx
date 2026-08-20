"use client";

import { useEffect, useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
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

/** F-04. Muncul setelah laporan tersimpan; opsional, replace-all per stage. */
export function InsightSheet({ open, onClose, leadReportId, stageCounts }: InsightSheetProps) {
  const [categories, setCategories] = useState<InsightCategory[]>([]);
  const [tab, setTab] = useState<Stage>("offering");
  const [counts, setCounts] = useState<Record<Stage, Record<string, number>>>({
    consultation: {},
    offering: {},
  });
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) apiFetch<InsightCategory[]>("/api/master/insight-categories").then(setCategories);
  }, [open]);

  const filled = Object.values(counts[tab]).reduce((s, n) => s + n, 0);
  const stageTotal = stageCounts[tab];

  function setCount(categoryId: string, value: number) {
    setCounts((prev) => ({ ...prev, [tab]: { ...prev[tab], [categoryId]: value } }));
  }

  async function handleSave() {
    setSaving(true);
    const insights = (["consultation", "offering"] as Stage[]).flatMap((stage) =>
      Object.entries(counts[stage])
        .filter(([, count]) => count > 0)
        .map(([category_id, lead_count]) => ({ stage, category_id, lead_count, note: note || undefined })),
    );
    try {
      await apiFetch(`/api/lead-reports/${leadReportId}/insights`, {
        method: "PUT",
        // stages: the two tabs this sheet manages, sent explicitly so a
        // cs zeroing out every category (insights becomes []) still clears
        // the stored rows instead of leaving stale insight data behind
        // (10-AUDIT-FE-BE.md #6).
        body: JSON.stringify({ stages: ["consultation", "offering"], insights }),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Tambah insight? (opsional)">
      <div className="mb-3 flex gap-2">
        {(["consultation", "offering"] as Stage[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setTab(s)}
            className={
              tab === s
                ? "rounded-full bg-navy-900 px-3 py-1.5 text-sm text-text-light"
                : "rounded-full border border-line px-3 py-1.5 text-sm text-ink-600"
            }
          >
            {s === "consultation" ? "Consultation" : "Offering"}
          </button>
        ))}
      </div>

      <p className="mb-3 text-xs text-ink-400">
        {filled} dari {stageTotal} lead {tab} sudah diberi insight
      </p>

      <div className="space-y-3">
        {categories.map((cat) => (
          <NumberStepper
            key={cat.id}
            label={cat.name}
            value={counts[tab][cat.id] ?? 0}
            onChange={(v) => setCount(cat.id, v)}
            min={0}
          />
        ))}
      </div>

      <textarea
        placeholder="Catatan bebas (opsional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="mt-4 h-20 w-full rounded-lg border border-line p-3 text-sm"
      />

      <div className="mt-4 flex gap-2">
        <button type="button" onClick={onClose} className="h-11 flex-1 rounded-lg border border-line text-sm font-medium">
          Lewati
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="h-11 flex-1 rounded-lg bg-brass text-sm font-semibold text-navy-900 disabled:opacity-50"
        >
          {saving ? "Menyimpan..." : "Simpan insight"}
        </button>
      </div>
    </BottomSheet>
  );
}
