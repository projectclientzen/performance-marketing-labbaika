export interface ThresholdCardProps {
  leftLabel: string;
  leftValue: string;
  rightLabel: string;
  rightValue: string;
  status: "safe" | "warning" | "over";
  /**
   * Posisi penanda pada batang, 0–1 (CPP dibagi break-even). Opsional supaya
   * kontrak DS-21b yang lama tetap jalan tanpa diubah; tanpa nilai ini batang
   * tampil polos seperti sebelumnya. Prototype menaruh titik pada posisi
   * proporsional, jadi tanpa angka ini kartunya kehilangan inti pesannya —
   * bukan "aman atau tidak", tapi *seberapa jauh* dari ambang.
   */
  ratio?: number;
  /** Keterangan kiri bawah, mis. "CPP di 9,9% break-even". */
  note?: string;
}

const STATUS = {
  safe: { color: "var(--color-ok)", chip: "aman", chipClass: "bg-ok/10 text-ok" },
  warning: { color: "var(--color-warn)", chip: "hati-hati", chipClass: "bg-warn/10 text-warn" },
  over: { color: "var(--color-danger)", chip: "lewat ambang", chipClass: "bg-danger/10 text-danger" },
} as const;

/** DS-21b. CPP vs Break-even CPP — kartu keputusan utama Owner (F-07). */
export function ThresholdCard({
  leftLabel,
  leftValue,
  rightLabel,
  rightValue,
  status,
  ratio,
  note,
}: ThresholdCardProps) {
  const s = STATUS[status];
  // Ambang 70% adalah batas "aman" di cppStatus() (lib/utils/profit.ts) dan
  // digambar sebagai garis di prototype, bukan cuma angka di keterangan.
  const markerPct = ratio === undefined ? null : Math.min(Math.max(ratio, 0), 1) * 100;

  return (
    <div className="rounded-card border border-line bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-sm font-semibold text-ink-900">
          {leftLabel} vs {rightLabel}
        </h3>
        <span className={`shrink-0 rounded-chip px-2 py-0.5 text-[11px] font-medium ${s.chipClass}`}>
          {s.chip}
        </span>
      </div>

      <div className="mt-3 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs text-ink-400">{leftLabel}</p>
          <p className="mt-0.5 font-mono text-xl font-semibold" style={{ color: s.color }}>
            {leftValue}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-ink-400">{rightLabel}</p>
          <p className="mt-0.5 font-mono text-xl font-semibold text-ink-900">{rightValue}</p>
        </div>
      </div>

      <div className="relative mt-3 h-1.5 w-full rounded-chip bg-line">
        <div
          aria-hidden
          className="absolute inset-y-0 w-px bg-brass"
          style={{ left: "70%" }}
          title="ambang 70%"
        />
        {markerPct !== null && (
          <span
            aria-hidden
            className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card transition-all duration-200"
            style={{ left: `${markerPct}%`, backgroundColor: s.color }}
          />
        )}
      </div>

      <div className="mt-2 flex justify-between gap-3 font-mono text-[11px] text-ink-400">
        <span>{note ?? ""}</span>
        <span>ambang 70%</span>
      </div>
    </div>
  );
}
