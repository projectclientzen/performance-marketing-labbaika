"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LogoutButton } from "@/components/LogoutButton";

/**
 * Kerangka layar Owner — F-07 di docs/labbaika-reporting.html.
 *
 * Desktop: sidebar navy tetap di kiri, diukur langsung dari prototype
 * (lihat commit sidebar sebelumnya). Tidak diubah oleh berkas ini.
 *
 * Mobile: diukur ulang dari frame mobile F-07 di prototype (posisi teks
 * per elemen, bukan tebakan). Temuan pentingnya mengoreksi versi
 * sebelumnya: nav utama mobile itu **bottom tab bar 4 item, di atas
 * latar terang** (bg-card, warna nonaktif = ink-400 #6e93a3, persis
 * cocok dengan token yang sudah ada) — bukan baris nav gelap yang bisa
 * digulir di atas. Ini juga persis pola yang sudah dipakai
 * app/cs/layout.tsx, jadi disamakan strukturnya di sini.
 *
 * Sembilan layar sekunder tidak punya representasi mobile di prototype
 * (itu mockup P0, hanya 4 tujuan utama yang digambar). Aturan #4 di
 * work order melarang mengarang layout yang tidak ada di prototype,
 * jadi bukan navigasi utama yang ditambah — cukup satu pengungkap kecil
 * "Lainnya" di pojok kanan atas, tidak mengambil bobot visual dari
 * empat tujuan utama.
 */

const PRIMARY = [
  { href: "/owner", label: "Overview", icon: "◔" },
  { href: "/owner/campaigns", label: "Campaign", icon: "▦" },
  { href: "/owner/leads", label: "Lead Intel", icon: "⚑" },
  { href: "/owner/export", label: "Export", icon: "⇩" },
];

// Mobile: tiga tujuan utama + tombol menu (☰) menggantikan Export di tab bar.
// Export ikut pindah ke dalam menu — dipakai sesekali, tidak sesering tiga
// layar analitik di sebelahnya. Sidebar desktop tidak ikut berubah: di sana
// keempatnya muat sekaligus, persis prototype.
const MOBILE_TABS = PRIMARY.slice(0, 3);

const SECONDARY = [
  { href: "/owner/rekap", label: "Rekap Lead Harian" },
  { href: "/owner/cs", label: "CS Performance" },
  { href: "/owner/reconciliation", label: "Reconciliation" },
  { href: "/owner/report", label: "Management Report" },
  { href: "/owner/programs", label: "Program & Harga" },
  { href: "/owner/riwayat", label: "Riwayat" },
  { href: "/owner/settings/sources", label: "Lead Source" },
  { href: "/owner/settings/import", label: "Import Ads" },
  { href: "/owner/settings/lock", label: "Period Lock" },
  { href: "/owner/settings/audit", label: "Audit Log" },
  { href: "/owner/settings/users", label: "User" },
];

// Isi menu "Lainnya" di mobile — Export di urutan pertama karena ia satu
// kelas dengan tab bar, sisanya layar sekunder.
const MOBILE_MENU = [{ href: "/owner/export", label: "Export" }, ...SECONDARY];

function isActive(pathname: string, href: string) {
  return href === "/owner" ? pathname === "/owner" : pathname.startsWith(href);
}

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [showMore, setShowMore] = useState(false);
  const menuActive = MOBILE_MENU.some((i) => isActive(pathname, i.href));

  return (
    <div className="min-h-screen bg-paper md:flex">
      {/* Header mobile: hanya identitas. Navigasi seluruhnya di tab bar
          bawah — lebih terjangkau ibu jari daripada pojok kanan atas. */}
      <header className="flex items-center border-b border-line bg-card px-4 py-3 md:hidden">
        <Link href="/owner" className="flex items-center gap-2">
          <Image src="/logo/labbaika-icon.jpg" alt="" width={24} height={24} className="rounded" priority />
          <span className="font-display text-sm font-semibold text-ink-900">Labbaika</span>
        </Link>
      </header>

      <aside className="hidden w-[220px] shrink-0 flex-col bg-ink-900 px-4 py-6 md:flex">
        <Link href="/owner" className="flex items-center gap-2.5 px-2 pb-5">
          <Image src="/logo/labbaika-icon.jpg" alt="" width={28} height={28} className="rounded" priority />
          <span className="font-display text-lg font-semibold text-white">Labbaika</span>
        </Link>

        <nav className="flex flex-col gap-1.5">
          {PRIMARY.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-[11px] text-sm transition-colors duration-200 ${
                  active ? "bg-navy-600 font-semibold text-white" : "font-normal text-on-dark-muted hover:bg-navy-800"
                }`}
              >
                <span aria-hidden className="w-4 shrink-0 text-center text-[13px]">
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-1.5">
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
                      active ? "bg-navy-600 font-medium text-white" : "text-on-dark-muted hover:bg-navy-800"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          )}
        </div>

        <div className="mt-auto border-t border-navy-700 pt-3">
          <LogoutButton className="w-full rounded-lg px-3 py-2 text-left text-[13px] text-on-dark-muted transition-colors duration-200 hover:bg-navy-800" />
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-5 pb-[calc(6rem+env(safe-area-inset-bottom))] md:px-6 md:py-6 md:pb-6">{children}</main>

      {/* Menu "Lainnya" naik dari bawah, sejajar tombol pemicunya di tab
          bar — bukan turun dari pojok kanan atas seperti sebelumnya. */}
      {showMore && (
        <>
          <button
            type="button"
            aria-label="Tutup menu"
            onClick={() => setShowMore(false)}
            className="fixed inset-0 z-10 bg-scrim md:hidden"
          />
          <nav className="fixed bottom-[calc(4.25rem+env(safe-area-inset-bottom))] left-0 right-0 z-20 max-h-[60vh] overflow-y-auto border-y border-line bg-card py-1.5 md:hidden">
            {MOBILE_MENU.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setShowMore(false)}
                  aria-current={active ? "page" : undefined}
                  className={`block px-4 py-2.5 text-sm transition-colors duration-200 ${
                    active ? "font-medium text-brass" : "text-ink-600"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            <div className="mt-1 border-t border-line px-4 pb-1 pt-2">
              <LogoutButton />
            </div>
          </nav>
        </>
      )}

      {/* Bottom tab bar mobile — tiga tujuan utama + tombol menu. Pola dan
          ukurannya sama dengan app/cs/layout.tsx supaya satu bahasa visual. */}
      <nav className="fixed bottom-0 left-0 right-0 z-20 flex border-t border-line bg-card pb-[env(safe-area-inset-bottom)] md:hidden">
        {MOBILE_TABS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setShowMore(false)}
              aria-current={active ? "page" : undefined}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 pb-3 text-[11px] ${
                active ? "font-semibold text-brass" : "font-normal text-ink-400"
              }`}
            >
              <span aria-hidden className="text-lg leading-none">
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          aria-expanded={showMore}
          className={`flex flex-1 flex-col items-center gap-1 py-2.5 pb-3 text-[11px] ${
            showMore || menuActive ? "font-semibold text-brass" : "font-normal text-ink-400"
          }`}
        >
          <span aria-hidden className="text-lg leading-none">
            ☰
          </span>
          Lainnya
        </button>
      </nav>
    </div>
  );
}
