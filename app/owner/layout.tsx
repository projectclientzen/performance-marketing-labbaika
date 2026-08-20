"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";

/**
 * Kerangka layar Owner — F-07 di docs/labbaika-reporting.html.
 *
 * Nilai di bawah diukur langsung dari prototype lewat getComputedStyle, bukan
 * dikira-kira dari tangkapan layar:
 *
 *   sidebar   lebar 220px · bg #0b3d54 · padding 24px 16px · jarak antaritem 6px
 *   logo      Bricolage Grotesque 16px/600 putih · padding 0 8px 20px · gap 10px
 *   item      padding 11px 12px · radius 8px · Instrument Sans 14px
 *   aktif     bg #0f5a78 · teks putih · weight 600
 *   nonaktif  transparan · teks #a6cbd8 · weight 400
 *   ikon      ◔ Overview · ▦ Campaign · ⚑ Lead Intel · ⇩ Export
 *
 * Prototype menampilkan tepat empat tujuan, dan itu yang dipakai di sini.
 * Percobaan sebelumnya menaruh sembilan layar sisanya langsung di bawah empat
 * itu; hasilnya sidebar yang tidak lagi mirip prototype, dan memang itu yang
 * dikeluhkan. Sekarang sembilan sisanya masuk ke pengungkap tertutup yang
 * ditempel di dasar sidebar, sehingga tampilan bawaannya sama dengan prototype
 * tapi tidak ada layar yang jadi tak terjangkau.
 */

const PRIMARY = [
  { href: "/owner", label: "Overview", icon: "◔" },
  { href: "/owner/campaigns", label: "Campaign", icon: "▦" },
  { href: "/owner/leads", label: "Lead Intel", icon: "⚑" },
  { href: "/owner/export", label: "Export", icon: "⇩" },
];

const SECONDARY = [
  { href: "/owner/cs", label: "CS Performance" },
  { href: "/owner/reconciliation", label: "Reconciliation" },
  { href: "/owner/report", label: "Management Report" },
  { href: "/owner/programs", label: "Program & Harga" },
  { href: "/owner/riwayat", label: "Riwayat" },
  { href: "/owner/settings/import", label: "Import Ads" },
  { href: "/owner/settings/lock", label: "Period Lock" },
  { href: "/owner/settings/audit", label: "Audit Log" },
  { href: "/owner/settings/users", label: "User" },
];

const ALL = [...PRIMARY, ...SECONDARY];

function isActive(pathname: string, href: string) {
  return href === "/owner" ? pathname === "/owner" : pathname.startsWith(href);
}

function itemClass(active: boolean) {
  return `rounded-lg px-3 py-[11px] text-sm transition-colors duration-200 ${
    active ? "bg-navy-600 font-semibold text-white" : "font-normal text-on-dark-muted hover:bg-navy-800"
  }`;
}

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [showMore, setShowMore] = useState(() => SECONDARY.some((i) => isActive(pathname, i.href)));

  return (
    <div className="min-h-screen bg-paper md:flex">
      {/* Sidebar tidak muat di bawah 768px. Prototype tidak menggambar varian
          mobile untuk layar Owner — di sana layar Owner desktop-first. */}
      <header className="bg-ink-900 md:hidden">
        <div className="flex items-center gap-2.5 px-4 pt-3">
          <Image src="/logo/labbaika-icon.jpg" alt="" width={26} height={26} className="rounded" priority />
          <span className="font-display text-base font-semibold text-white">Labbaika</span>
        </div>
        <nav className="flex gap-1.5 overflow-x-auto px-3 pb-2.5 pt-2.5">
          {ALL.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(pathname, item.href) ? "page" : undefined}
              className={`shrink-0 whitespace-nowrap ${itemClass(isActive(pathname, item.href))}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <aside className="hidden w-[220px] shrink-0 flex-col bg-ink-900 px-4 py-6 md:flex">
        <Link href="/owner" className="flex items-center gap-2.5 px-2 pb-5">
          <Image src="/logo/labbaika-icon.jpg" alt="" width={28} height={28} className="rounded" priority />
          <span className="font-display text-base font-semibold text-white">Labbaika</span>
        </Link>

        <nav className="flex flex-col gap-1.5">
          {PRIMARY.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2.5 ${itemClass(active)}`}
              >
                <span aria-hidden className="w-4 shrink-0 text-center text-[13px]">
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto pt-6">
          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            aria-expanded={showMore}
            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-[13px] text-on-dark-muted transition-colors duration-200 hover:bg-navy-800"
          >
            Lainnya
            <span aria-hidden className="text-[10px]">
              {showMore ? "▴" : "▾"}
            </span>
          </button>

          {showMore && (
            <nav className="mt-1 flex flex-col gap-0.5">
              {SECONDARY.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`rounded-lg px-3 py-2 text-[13px] transition-colors duration-200 ${
                      active
                        ? "bg-navy-600 font-medium text-white"
                        : "text-on-dark-muted hover:bg-navy-800"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          )}
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-5 md:px-6 md:py-6">{children}</main>
    </div>
  );
}
