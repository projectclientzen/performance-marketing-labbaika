import Link from "next/link";
import Image from "next/image";

const NAV_ITEMS = [
  { href: "/owner", label: "Overview" },
  { href: "/owner/campaigns", label: "Campaign Quality" },
  { href: "/owner/cs", label: "CS Performance" },
  { href: "/owner/leads", label: "Lead Intelligence" },
  { href: "/owner/reconciliation", label: "Reconciliation" },
  { href: "/owner/report", label: "Management Report" },
  { href: "/owner/export", label: "Export" },
  { href: "/owner/programs", label: "Program & HPP" },
  { href: "/owner/riwayat", label: "Riwayat" },
  { href: "/owner/settings/import", label: "Import Ads" },
  { href: "/owner/settings/lock", label: "Period Lock" },
  { href: "/owner/settings/audit", label: "Audit Log" },
  { href: "/owner/settings/users", label: "User" },
];

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-line bg-navy-900 px-4 py-3 md:px-8">
        <div className="mx-auto flex max-w-6xl items-center gap-4">
          <Link href="/owner" className="flex shrink-0 items-center gap-2">
            <Image src="/logo/labbaika-icon.jpg" alt="Labbaika" width={28} height={28} className="rounded" priority />
            <span className="font-display text-lg font-bold text-text-light">Labbaika</span>
          </Link>
          <nav className="flex gap-4 overflow-x-auto">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="shrink-0 whitespace-nowrap text-sm text-text-light/80 hover:text-brass"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 md:px-8">{children}</main>
    </div>
  );
}
