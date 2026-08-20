export interface MetricCardProps {
  label: string;
  value: string;
  delta?: string;
  variant?: "default" | "accent";
  chip?: string;
  loading?: boolean;
}

/**
 * DS-21. Kartu metrik — F-07 di docs/labbaika-reporting.html.
 *
 * Susunannya label kecil di atas, angka besar monospace, keterangan kecil di
 * bawah. `delta` mengisi baris ketiga itu: di prototype isinya bukan selisih
 * periode melainkan angka pendamping — "Meta Ads" di bawah Spend, "CPL
 * Rp20.000" di bawah Lead, "CPP Rp333.333" di bawah Closing. Propnya tidak
 * diubah supaya kontrak DS-21 utuh; hanya perannya yang diperjelas di sini.
 */
export function MetricCard({ label, value, delta, variant = "default", chip, loading }: MetricCardProps) {
  if (loading) {
    return (
      <div className="rounded-card border border-line bg-card p-4">
        <div className="h-3 w-16 animate-pulse rounded bg-line" />
        <div className="mt-3 h-7 w-28 animate-pulse rounded bg-line" />
        <div className="mt-2 h-3 w-20 animate-pulse rounded bg-line" />
      </div>
    );
  }

  const accent = variant === "accent";

  return (
    <div
      className={`rounded-card border p-4 ${
        accent ? "border-brass/40 bg-brass-lo" : "border-line bg-card"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[13px] text-ink-400">{label}</span>
        {chip && (
          <span className="shrink-0 rounded-chip bg-line px-2 py-0.5 font-mono text-[10px] text-ink-600">
            {chip}
          </span>
        )}
      </div>
      <div
        className={`mt-1.5 font-mono text-[26px] font-semibold leading-none tracking-tight ${
          accent ? "text-brass" : "text-ink-900"
        }`}
      >
        {value}
      </div>
      {delta && <div className="mt-2 text-xs text-ink-400">{delta}</div>}
    </div>
  );
}
