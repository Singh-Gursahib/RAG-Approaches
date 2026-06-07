"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { Menu, X } from "lucide-react";
import { BackendStatus } from "./BackendStatus";
import { KeyStatusPill } from "./KeyStatusPill";
import { HelpMenu } from "./HelpMenu";

const NAV = [
  { href: "/playground", label: "Playground" },
  { href: "/compare", label: "Compare" },
  { href: "/evaluate", label: "Evaluate" },
  { href: "/replay", label: "Replay" },
  { href: "/profiler", label: "Profiler" },
  { href: "/recommend", label: "Recommend" },
  { href: "/history", label: "History" },
];

export function Header() {
  const pathname = usePathname();
  const [menu, setMenu] = useState(false);

  // Close the mobile menu whenever the route changes.
  useEffect(() => {
    setMenu(false);
  }, [pathname]);

  return (
    <header className="glass sticky top-0 z-50 border-b border-line">
      <div className="shell flex h-16 items-center justify-between gap-4">
        <Link href="/" className="group flex items-center gap-2.5">
          <Logo />
          <span className="font-display text-[19px] leading-none tracking-tightest">RAG&nbsp;Atlas</span>
        </Link>

        <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Primary">
          {NAV.map((item) => (
            <NavLink key={item.href} {...item} pathname={pathname} />
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <span className="hidden xl:inline-flex">
            <BackendStatus compact />
          </span>
          <HelpMenu />
          <KeyStatusPill />
          <button
            onClick={() => setMenu((v) => !v)}
            aria-label={menu ? "Close menu" : "Open menu"}
            aria-expanded={menu}
            className="grid h-8 w-8 place-items-center rounded-full text-ink-muted hover:bg-ink/[0.05] hover:text-ink lg:hidden"
          >
            {menu ? <X className="h-[18px] w-[18px]" /> : <Menu className="h-[18px] w-[18px]" />}
          </button>
        </div>
      </div>

      {/* mobile nav */}
      {menu && (
        <nav className="border-t border-line bg-canvas/95 lg:hidden" aria-label="Mobile">
          <div className="shell grid grid-cols-2 gap-1.5 py-3">
            {NAV.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "rounded-[10px] px-3 py-2.5 text-[14px] transition-colors",
                    active ? "bg-ink text-canvas" : "text-ink-muted hover:bg-ink/[0.05]",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </header>
  );
}

function NavLink({ href, label, pathname }: { href: string; label: string; pathname: string }) {
  const active = pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={clsx(
        "rounded-pill px-2.5 py-1.5 text-[13px] transition-colors",
        active ? "bg-ink text-canvas" : "text-ink-muted hover:bg-ink/[0.05] hover:text-ink",
      )}
    >
      {label}
    </Link>
  );
}

/** A small compass-rose mark — an "atlas" cue. */
function Logo() {
  return (
    <span
      aria-hidden
      className="grid h-7 w-7 place-items-center rounded-[9px] bg-ink text-canvas transition-transform group-hover:rotate-45"
    >
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
        <path d="M8 1.2 9.4 6.6 14.8 8 9.4 9.4 8 14.8 6.6 9.4 1.2 8 6.6 6.6 8 1.2Z" fill="currentColor" />
      </svg>
    </span>
  );
}
