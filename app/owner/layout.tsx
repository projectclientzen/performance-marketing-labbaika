"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

/**
 * Kerangka layar Owner — F-07 di docs/labbaika-reporting.html.
 *
 * Prototype memakai sidebar navy tetap di kiri, bukan baris nav horizontal.
 * Bedanya bukan selera: dengan 13 tujuan, versi horizontal memaksa scroll
 * menyamping dan label-labelnya berdesakan sampai tidak terbaca — persis yang
 * dikeluhkan.
 *
 * Sidebar di prototype cuma menampilkan empat tujuan (Overview, Campaign,
 * Lead Intel, Export) karena itu mockup P0. Aplikasinya punya 13 layar nyata,
 * dan menyembunyikan sembilan di antaranya berarti membuang fitur demi
 * kemiripan gambar. Jalan tengahnya: empat itu tetap jadi kelompok utama
 * sesuai prototype, sisanya turun ke kelompok kedua di bawah pemisah. Bentuk
 * dan bobot visualnya sama, cakupannya utuh.
 */

const PRIMARY = [
  { href: "/owner", label: "Overview", icon: "◷" },
  { href: "/owner/campaigns", label: "Campaign", icon: "▤" },
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

function isActive(pathname: string, href: string) {
  return href === "/owner" ? pathname === "/owner" : pathname.startsWith(href);
}

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-paper md:flex">
      {/* Mobile: sidebar tidak muat, jadi jadi baris yang bisa digeser.
          Prototype memang tidak menggambar varian ini untuk layar Owner —
          layar Owner di sana desktop-first. */}
      <header className="bg-ink-900 md:hidden">
        <div className="flex items-center gap-2 px-4 pt-3">
          <Image src="/logo/labbaika-icon.jpg" alt="" width={26} height={26} className="rounded" priority />
          <span className="font-display text-base font-bold text-on-dark">Labbaika</span>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2 pt-2">
          {[...PRIMARY, ...SECONDARY].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(pathname, item.href) ? "page" : undefined}
              className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition-colors duration-200 ${
                isActive(pathname, item.href)
                  ? "bg-navy-600 font-medium text-on-dark"
                  : "text-on-dark-muted hover:text-on-dark"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <aside className="hidden w-56 shrink-0 bg-ink-900 md:flex md:flex-col">
        <Link href="/owner" className="flex items-center gap-2.5 px-5 py-5">
          <Image src="/logo/labbaika-icon.jpg" alt="" width={30} height={30} className="rounded" priority />
          <span className="font-display text-lg font-bold text-on-dark">Labbaika</span>
        </Link>

        <nav className="flex flex-col gap-0.5 px-3">
          {PRIMARY.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(pathname, item.href) ? "page" : undefined}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors duration-200 ${
                isActive(pathname, item.href)
                  ? "bg-navy-600 font-semibold text-on-dark"
                  : "text-on-dark-muted hover:bg-navy-800 hover:text-on-dark"
              }`}
            >
              <span aria-hidden className="w-4 text-center text-xs opacity-80">
                {item.icon}
              </span>
              {item.label}
            </Link>
          ))}

          <hr className="my-3 border-navy-700" />

          {SECONDARY.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(pathname, item.href) ? "page" : undefined}
              className={`rounded-lg px-3 py-2 pl-[34px] text-[13px] transition-colors duration-200 ${
                isActive(pathname, item.href)
                  ? "bg-navy-600 font-medium text-on-dark"
                  : "text-on-dark-muted hover:bg-navy-800 hover:text-on-dark"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-5 md:px-7 md:py-6">{children}</main>
    </div>
  );
}
