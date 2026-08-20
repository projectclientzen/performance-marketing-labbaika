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
  { href: "/cs/performa", label: "Performa", icon: "◔" },
];

export default function CsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-paper pb-20">
      <div className="mx-auto max-w-lg">{children}</div>

      <nav className="fixed bottom-0 left-0 right-0 flex border-t border-line bg-card">
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
