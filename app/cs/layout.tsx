"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

/**
 * CS layout — responsive.
 *
 * Mobile (default): bottom tab bar (prototype F-02 mobile).
 * Desktop (≥1024px): 220px navy sidebar (prototype F-02 desktop).
 *
 * Nav items match prototype exactly — 4 items, glyph icons.
 * "Program" is accessible via sidebar menu on desktop (secondary).
 */

const NAV_ITEMS = [
  { href: "/cs", label: "Beranda", icon: "⌂" },
  { href: "/cs/laporan", label: "Laporan", icon: "▤" },
  { href: "/cs/closing", label: "Closing", icon: "✓" },
  { href: "/cs/programs", label: "Program", icon: "❖" },
  { href: "/cs/performa", label: "Performa", icon: "◔" },
];

function isActive(href: string, pathname: string) {
  return href === "/cs" ? pathname === "/cs" : pathname.startsWith(href);
}

export default function CsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-paper">
      {/* ── Desktop sidebar ── */}
      <nav className="fixed inset-y-0 left-0 z-30 hidden w-[220px] flex-col bg-ink-900 lg:flex">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 pb-5 pt-6">
          <div className="flex h-[34px] w-[34px] items-center justify-center overflow-hidden rounded-[9px] bg-card">
            <Image
              src="/logo/labbaika-icon.jpg"
              alt="Labbaika"
              width={34}
              height={34}
              className="h-full w-full object-cover"
            />
          </div>
          <span className="font-[var(--fh)] text-sm font-semibold text-white">
            Labbaika
          </span>
        </div>

        {/* Nav items */}
        <div className="flex flex-1 flex-col gap-1.5 px-3">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  active
                    ? "bg-[#0F5A78] font-semibold text-white"
                    : "font-normal text-[#A6CBD8] hover:bg-white/5"
                }`}
              >
                <span className="text-base leading-none">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-4 pb-5 pt-3">
          <div className="text-[11px] text-[#5487A0]">Labbaika Group · v1.1</div>
        </div>
      </nav>

      {/* ── Main content ── */}
      <div className="pb-[calc(5rem+env(safe-area-inset-bottom))] lg:ml-[220px] lg:pb-0">
        <div className="mx-auto max-w-lg px-4 py-5 lg:mx-0 lg:max-w-none lg:px-9 lg:py-8">
          {children}
        </div>
      </div>

      {/* ── Mobile bottom nav ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 flex border-t border-line bg-card pb-[env(safe-area-inset-bottom)] lg:hidden">
        <div className="mx-auto flex w-full max-w-lg">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href, pathname);
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
