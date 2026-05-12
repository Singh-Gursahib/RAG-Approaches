import Link from "next/link";

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/pareto", label: "Pareto" },
  { href: "/compare", label: "Compare" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-50 bg-canvas/80 backdrop-blur-xl border-b border-border/50">
      <div className="mx-auto max-w-[1320px] px-6 sm:px-10 lg:px-14 h-16 flex items-center justify-between">
        <Link href="/" className="group flex items-center gap-3">
          <div className="relative">
            <span className="block w-2 h-2 rounded-full bg-accent" />
            <span className="absolute inset-0 w-2 h-2 rounded-full bg-accent animate-ping opacity-40" />
          </div>
          <span className="font-display text-[19px] tracking-tightest text-ink">RAG_Ureap</span>
          <span className="hidden sm:inline text-[11px] uppercase tracking-[0.14em] text-ink-faint font-mono ml-2">
            Long-context lab
          </span>
        </Link>
        <nav className="flex items-center gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="px-3 sm:px-4 py-1.5 text-sm text-ink-muted hover:text-ink rounded-full transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
