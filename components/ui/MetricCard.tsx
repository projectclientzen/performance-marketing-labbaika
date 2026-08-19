export interface MetricCardProps {
  label: string;
  value: string;
  delta?: string;
  variant?: "default" | "accent";
  chip?: string;
  loading?: boolean;
}

/** DS-21. Kartu metrik, angka besar Plex Mono, varian accent pakai brass. */
export function MetricCard({ label, value, delta, variant = "default", chip, loading }: MetricCardProps) {
  if (loading) {
    return (
      <div className="rounded-[10px] border border-line bg-card p-4">
        <div className="h-3 w-20 animate-pulse rounded bg-line" />
        <div className="mt-3 h-7 w-28 animate-pulse rounded bg-line" />
      </div>
    );
  }

  return (
    <div
      className={
        variant === "accent"
          ? "rounded-[10px] border border-brass/40 bg-brass-lo p-4"
          : "rounded-[10px] border border-line bg-card p-4"
      }
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-ink-600">{label}</span>
        {chip && (
          <span className="rounded-full bg-line px-2 py-0.5 text-[10px] font-medium text-ink-600">
            {chip}
          </span>
        )}
      </div>
      <div
        className={
          variant === "accent"
            ? "mt-1 font-mono text-2xl font-semibold text-brass"
            : "mt-1 font-mono text-2xl font-semibold text-ink-900"
        }
      >
        {value}
      </div>
      {delta && <div className="mt-0.5 text-xs text-ink-400">{delta}</div>}
    </div>
  );
}
