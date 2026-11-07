"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Slate" },
  { href: "/builder", label: "Power" },
  { href: "/journal", label: "Journal" },
  { href: "/glossary", label: "Glossary" },
  { href: "/settings", label: "Settings" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="relative z-10 min-h-screen">
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[#0b0d10cc] backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="flex items-center gap-3">
            <span className="pulse-dot" />
            <div>
              <div className="mono text-sm tracking-[0.18em] text-[var(--accent)]">
                FORMCAST
              </div>
              <div className="text-[11px] text-[var(--fg-dim)]">
                wholesale desk · soccer + nba
              </div>
            </div>
          </Link>
          <nav className="flex items-center gap-1">
            {NAV.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/" || pathname.startsWith("/dossier")
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "mono rounded-md px-3 py-1.5 text-xs uppercase tracking-wider transition-colors",
                    active
                      ? "bg-[var(--panel-2)] text-[var(--accent)]"
                      : "text-[var(--fg-muted)] hover:text-[var(--fg)]",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      <footer className="mx-auto max-w-7xl px-4 pb-8 text-[11px] text-[var(--fg-dim)]">
        For fun research only — not financial advice. Free-tier data can be
        delayed, blocked, or quota-capped.
      </footer>
    </div>
  );
}