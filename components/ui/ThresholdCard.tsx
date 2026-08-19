export interface ThresholdCardProps {
  leftLabel: string;
  leftValue: string;
  rightLabel: string;
  rightValue: string;
  status: "safe" | "warning" | "over";
}

const STATUS_COLOR: Record<ThresholdCardProps["status"], string> = {
  safe: "var(--color-ok)",
  warning: "var(--color-warn)",
  over: "var(--color-danger)",
};

/** DS-21b. CPP vs Break-even CPP — kartu keputusan utama Owner. */
export function ThresholdCard({ leftLabel, leftValue, rightLabel, rightValue, status }: ThresholdCardProps) {
  return (
    <div className="rounded-[10px] border border-line bg-card p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-ink-600">{leftLabel}</p>
          <p className="font-mono text-xl font-semibold text-ink-900">{leftValue}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-ink-600">{rightLabel}</p>
          <p className="font-mono text-xl font-semibold text-ink-900">{rightValue}</p>
        </div>
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-line">
        <div className="h-full w-full" style={{ backgroundColor: STATUS_COLOR[status] }} />
      </div>
    </div>
  );
}
