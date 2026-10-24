import { cn } from "@/lib/utils";

export function Badge({
  className,
  tone = "default",
  children,
}: {
  className?: string;
  tone?: "default" | "good" | "warn" | "bad" | "accent" | "muted";
  children: React.ReactNode;
}) {
  const tones = {
    default: "border-[var(--border)] text-[var(--fg-muted)] bg-[var(--panel-2)]",
    good: "border-emerald-500/40 text-emerald-300 bg-emerald-500/10",
    warn: "border-amber-500/40 text-amber-300 bg-amber-500/10",
    bad: "border-rose-500/40 text-rose-300 bg-rose-500/10",
    accent: "border-[var(--accent)]/40 text-[var(--accent)] bg-[var(--accent)]/10",
    muted: "border-transparent text-[var(--fg-dim)] bg-transparent",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wide",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}