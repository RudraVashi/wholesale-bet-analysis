import { Suspense } from "react";
import { DossierView } from "@/components/dossier/dossier-view";

export default function DossierPage() {
  return (
    <Suspense
      fallback={
        <div className="mono text-sm text-[var(--fg-dim)]">Opening dossier…</div>
      }
    >
      <DossierView />
    </Suspense>
  );
}