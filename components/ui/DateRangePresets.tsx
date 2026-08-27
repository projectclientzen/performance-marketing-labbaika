"use client";

import { monthRange, todayJakarta } from "@/lib/utils/date";

export type RangePreset = "hari-ini" | "kemarin" | "seminggu" | "bulan-ini" | "bulan-lalu" | "custom";

const OPTIONS: { value: RangePreset; label: string }[] = [
  { value: "hari-ini", label: "Hari ini" },
  { value: "kemarin", label: "Kemarin" },
  { value: "seminggu", label: "Seminggu terakhir" },
  { value: "bulan-ini", label: "Bulan ini" },
  { value: "bulan-lalu", label: "Bulan lalu" },
  { value: "custom", label: "Kustom…" },
];

/** Geser tanggal 'YYYY-MM-DD' sejumlah hari (lewat Date lokal, hindari UTC). */
function shift(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

/** Rentang tanggal untuk sebuah preset (custom memakai nilai lama pemanggil). */
export function rangeForPreset(preset: RangePreset, current?: { from: string; to: string }): { from: string; to: string } {
  const today = todayJakarta();
  switch (preset) {
    case "hari-ini":
      return { from: today, to: today };
    case "kemarin": {
      const y = shift(today, -1);
      return { from: y, to: y };
    }
    case "seminggu":
      return { from: shift(today, -6), to: today };
    case "bulan-ini":
      return { from: `${today.slice(0, 7)}-01`, to: today };
    case "bulan-lalu": {
      const [yy, mm] = today.split("-").map(Number);
      const prev = new Date(yy, mm - 2, 1);
      return monthRange(prev.getFullYear(), prev.getMonth() + 1);
    }
    default:
      return current ?? { from: `${today.slice(0, 7)}-01`, to: today };
  }
}

export interface DateRangePresetsProps {
  preset: RangePreset;
  from: string;
  to: string;
  onChange: (next: { preset: RangePreset; from: string; to: string }) => void;
}

export function DateRangePresets({ preset, from, to, onChange }: DateRangePresetsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-line bg-card p-3">
      <select
        value={preset}
        onChange={(e) => {
          const next = e.target.value as RangePreset;
          onChange({ preset: next, ...rangeForPreset(next, { from, to }) });
        }}
        className="h-10 rounded-lg border border-line px-2 text-sm text-ink-900"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {preset === "custom" ? (
        <>
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => onChange({ preset, from: e.target.value, to })}
            className="h-10 rounded-lg border border-line px-2 text-sm text-ink-900"
          />
          <span className="text-ink-400">–</span>
          <input
            type="date"
            value={to}
            min={from}
            max={todayJakarta()}
            onChange={(e) => onChange({ preset, from, to: e.target.value })}
            className="h-10 rounded-lg border border-line px-2 text-sm text-ink-900"
          />
        </>
      ) : (
        <span className="font-mono text-[13px] text-ink-600">
          {from} – {to}
        </span>
      )}
    </div>
  );
}
