import Link from "next/link";

const NAV_ITEMS = [
  { href: "/cs", label: "Beranda", icon: "🏠" },
  { href: "/cs/laporan", label: "Laporan", icon: "📋" },
  { href: "/cs/closing", label: "Closing", icon: "✅" },
  { href: "/cs/performa", label: "Performa", icon: "📊" },
];

export default function CsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper pb-20">
      <div className="mx-auto max-w-lg px-4 pt-6">{children}</div>

      <nav className="fixed bottom-0 left-0 right-0 border-t border-line bg-card">
        <div className="mx-auto flex max-w-lg">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs text-ink-600"
            >
              <span className="text-lg leading-none">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
