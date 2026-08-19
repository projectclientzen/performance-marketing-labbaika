import type { ReactNode } from "react";

export interface BannerProps {
  variant: "info" | "warn" | "danger" | "ok";
  children: ReactNode;
}

const STYLES: Record<BannerProps["variant"], string> = {
  info: "bg-blue/10 text-ink-900 border-blue/30",
  warn: "bg-warn/10 text-ink-900 border-warn/40",
  danger: "bg-danger/10 text-ink-900 border-danger/40",
  ok: "bg-ok/10 text-ink-900 border-ok/40",
};

/** DS-23. Dipakai untuk status offline dan periode terkunci. */
export function Banner({ variant, children }: BannerProps) {
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${STYLES[variant]}`} role="status">
      {children}
    </div>
  );
}
