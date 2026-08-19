import Link from "next/link";

const NAV_ITEMS = [
  { href: "/owner", label: "Overview" },
  { href: "/owner/campaigns", label: "Campaign Quality" },
  { href: "/owner/cs", label: "CS Performance" },
];

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-line bg-navy-900 px-4 py-3 md:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <span className="font-display text-lg font-bold text-text-light">Labbaika</span>
          <nav className="flex gap-4">
            {NAV_ITEMS.map((item) => (
              <Link key={item.href} href={item.href} className="text-sm text-text-light/80 hover:text-brass">
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
