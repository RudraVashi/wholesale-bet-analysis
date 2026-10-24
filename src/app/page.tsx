import { Suspense } from "react";
import { SlateView } from "@/components/slate/slate-view";

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="mono text-sm text-[var(--fg-dim)]">Loading slate…</div>
      }
    >
      <SlateView />
    </Suspense>
  );
}