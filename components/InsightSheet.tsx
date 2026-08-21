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
      <div className="mb-3.5 flex gap-1 rounded-full border border-line bg-card p-1">
        {(["consultation", "offering"] as Stage[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setTab(s)}
            className={
              tab === s
                ? "h-[38px] flex-1 rounded-full bg-navy-900 text-sm font-medium text-white"
                : "h-[38px] flex-1 rounded-full text-sm font-medium text-ink-600"
            }
          >
            {s === "consultation" ? "Consultation" : "Offering"}
          </button>
        ))}
      </div>

      {/* prototype: 13px/400, ink-600 -- measured via getComputedStyle, not
          Tailwind's default text-xs/ink-400 this used to read. */}
      <p className="mb-3 text-[13px] text-ink-600">
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

      {/* prototype: 342x64 (h-16, not h-20), padding 10px 12px. */}
      <textarea
        placeholder="Catatan bebas (opsional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="mt-4 h-16 w-full rounded-lg border border-line px-3 py-2.5 text-sm"
      />

      {/* prototype: 50px tall (not 44), Lewati sized to its own content
          rather than splitting the row evenly with Simpan -- the primary
          action visually dominates. */}
      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={onClose}
          className="h-[50px] shrink-0 rounded-lg border border-line px-6 text-[15px] font-medium"
        >
          Lewati
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="h-[50px] flex-1 rounded-lg bg-brass text-[15px] font-semibold text-on-brass disabled:opacity-50"
        >
          {saving ? "Menyimpan..." : "Simpan insight"}
        </button>
      </div>
    </BottomSheet>
  );
}
