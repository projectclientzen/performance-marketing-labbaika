"use client";

export interface NumberStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label?: string;
  hint?: string;
  error?: string;
}

/**
 * DS-20. Stepper besar (min 44px) supaya CS bisa isi satu tangan di HP,
 * plus input angka langsung untuk keyboard numerik.
 */
export function NumberStepper({ value, onChange, min = 0, max, label, hint, error }: NumberStepperProps) {
  const clamp = (n: number) => {
    let v = n;
    if (min !== undefined) v = Math.max(min, v);
    if (max !== undefined) v = Math.min(max, v);
    return v;
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        {label && <label className="text-sm text-ink-600">{label}</label>}
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Kurangi"
            onClick={() => onChange(clamp(value - 1))}
            disabled={min !== undefined && value <= min}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-line bg-paper text-xl leading-none text-ink-600 disabled:opacity-40"
          >
            −
          </button>
          <input
            type="number"
            inputMode="numeric"
            value={value}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              onChange(Number.isNaN(n) ? 0 : clamp(n));
            }}
            className="h-11 w-14 rounded-lg border border-line text-center font-mono text-base text-ink-900"
          />
          <button
            type="button"
            aria-label="Tambah"
            onClick={() => onChange(clamp(value + 1))}
            disabled={max !== undefined && value >= max}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-line bg-paper text-xl leading-none text-ink-600 disabled:opacity-40"
          >
            +
          </button>
        </div>
      </div>
      {error ? (
        <p className="mt-1 text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-ink-400">{hint}</p>
      ) : null}
    </div>
  );
}
