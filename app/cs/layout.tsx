"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Glyphs match the prototype exactly (docs/labbaika-reporting.html F-02's
// bottom nav) -- not emoji, which read as informal next to the prototype's
// plain geometric icon set.
const NAV_ITEMS = [
  { href: "/cs", label: "Beranda", icon: "⌂" },
  { href: "/cs/laporan", label: "Laporan", icon: "▤" },
  { href: "/cs/closing", label: "Closing", icon: "✓" },
  { href: "/cs/programs", label: "Program", icon: "❖" },
  { href: "/cs/performa", label: "Performa", icon: "◔" },
];

export default function CsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // pb container = tinggi bottom-nav + safe-area home-indicator iPhone, supaya
  // konten terakhir tidak ketutup nav. Butuh viewportFit:"cover" di root.
  return (
    <div className="min-h-screen bg-paper pb-[calc(5rem+env(safe-area-inset-bottom))]">
      <div className="mx-auto max-w-lg">{children}</div>

      {/* pb-[env(safe-area-inset-bottom)]: bg bar mengisi area home-indicator,
          tapi tombol tetap di atasnya — tap target tidak ketiban indicator. */}
      <nav className="fixed bottom-0 left-0 right-0 flex border-t border-line bg-card pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex w-full max-w-lg">
          {NAV_ITEMS.map((item) => {
            const active = item.href === "/cs" ? pathname === "/cs" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-1 flex-col items-center gap-1 py-2.5 pb-3 text-[11px] ${
                  active ? "font-semibold text-brass" : "font-normal text-ink-400"
                }`}
              >
                <span className="text-lg leading-none">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
