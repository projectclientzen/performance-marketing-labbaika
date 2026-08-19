"use client";

const STAGE_COLORS: Record<string, string> = {
  cold: "var(--color-stage-cold)",
  consultation: "var(--color-stage-consult)",
  offering: "var(--color-stage-offer)",
  closing: "var(--color-stage-closing)",
};

const STAGE_LABELS: Record<string, string> = {
  cold: "Cold",
  consultation: "Konsultasi",
  offering: "Offering",
  closing: "Closing",
};

export interface StageRailSegment {
  stage: "cold" | "consultation" | "offering" | "closing";
  value: number;
  color?: string;
}

export interface StageRailProps {
  segments: StageRailSegment[];
  size: "mini" | "medium" | "large";
  withNumbers?: boolean;
}

const HEIGHTS: Record<StageRailProps["size"], number> = {
  mini: 4,
  medium: 12,
  large: 40,
};

/**
 * DS-19. Satu batang tersegmen proporsional terhadap jumlah lead per stage.
 * Elemen signature dari 03-BRIEF-FE-ClaudeDesign.md §2 — dipakai konsisten
 * di CS dan Owner, tiga skala berbeda.
 */
export function StageRail({ segments, size, withNumbers = false }: StageRailProps) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const height = HEIGHTS[size];

  return (
    <div>
      <div
        className="flex w-full overflow-hidden transition-all duration-200 ease-out"
        style={{ height, borderRadius: height >= 40 ? 8 : height }}
      >
        {total === 0 ? (
          <div className="w-full bg-line" />
        ) : (
          segments.map((s) => (
            <div
              key={s.stage}
              className="transition-all duration-200 ease-out"
              style={{
                width: `${(s.value / total) * 100}%`,
                backgroundColor: s.color ?? STAGE_COLORS[s.stage],
              }}
              title={`${STAGE_LABELS[s.stage]}: ${s.value}`}
            />
          ))
        )}
      </div>
      {withNumbers && (
        <div className="mt-2 flex flex-wrap gap-3 text-xs text-ink-600">
          {segments.map((s) => (
            <span key={s.stage} className="inline-flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: s.color ?? STAGE_COLORS[s.stage] }}
              />
              {STAGE_LABELS[s.stage]}: <span className="font-mono">{s.value}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
