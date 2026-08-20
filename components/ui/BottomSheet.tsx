"use client";

import { useEffect, useRef } from "react";

export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

/** DS-24. Naik dari bawah, backdrop, scroll lock, Escape closes. */
export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    sheetRef.current?.focus();
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label="Tutup"
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
      />
      <div
        ref={sheetRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-[20px] bg-paper px-[18px] pb-6 pt-5 shadow-xl outline-none"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" />
        {title && <h2 className="mb-3 font-display text-lg font-bold text-ink-900">{title}</h2>}
        {children}
      </div>
    </div>
  );
}
