"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { useJournal } from "@/lib/hooks/use-local-store";
import type { JournalEntry } from "@/lib/types";
import { useMemo } from "react";

export function JournalView() {
  const { entries, updateResult, removeEntry, ready } = useJournal();

  const stats = useMemo(() => {
    const graded = entries.filter((e) => e.result !== "pending");
    const wins = graded.filter((e) => e.result === "win").length;
    const losses = graded.filter((e) => e.result === "loss").length;
    const pushes = graded.filter((e) => e.result === "push").length;
    return {
      pending: entries.filter((e) => e.result === "pending").length,
      wins,
      losses,
      pushes,
      hitRate: wins + losses > 0 ? wins / (wins + losses) : 0,
    };
  }, [entries]);

  if (!ready) {
    return (
      <Card>
        <CardBody className="mono text-sm text-[var(--fg-dim)]">Loading journal…</CardBody>
      </Card>
    );
  }

  return (
    <div className="fade-in space-y-5">
      <div>
        <h1 className="mono text-2xl tracking-tight">Journal</h1>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">
          Post-mortem log — platform, legs, optional stake. Grade after the
          slate settles.
        </p>
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
        <Stat label="Pending" value={String(stats.pending)} />
        <Stat label="Wins" value={String(stats.wins)} tone="good" />
        <Stat label="Losses" value={String(stats.losses)} tone="bad" />
        <Stat label="Pushes" value={String(stats.pushes)} />
        <Stat
          label="Hit rate"
          value={`${Math.round(stats.hitRate * 100)}%`}
          tone="accent"
        />
      </div>

      {entries.length === 0 ? (
        <Card>
          <CardBody className="text-sm text-[var(--fg-muted)]">
            No entries yet. Build a Power play and save it.
          </CardBody>
        </Card>
      ) : (
        <div className="grid gap-3">
          {entries.map((entry) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              onResult={(r) => updateResult(entry.id, r)}
              onRemove={() => removeEntry(entry.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad" | "accent";
}) {
  const color =
    tone === "good"
      ? "text-[var(--good)]"
      : tone === "bad"
        ? "text-[var(--danger)]"
        : tone === "accent"
          ? "text-[var(--accent)]"
          : "";
  return (
    <Card>
      <CardBody>
        <div className="mono text-[10px] uppercase text-[var(--fg-dim)]">
          {label}
        </div>
        <div className={`mt-1 text-xl ${color}`}>{value}</div>
      </CardBody>
    </Card>
  );
}

function EntryCard({
  entry,
  onResult,
  onRemove,
}: {
  entry: JournalEntry;
  onResult: (r: JournalEntry["result"]) => void;
  onRemove: () => void;
}) {
  const tone =
    entry.result === "win"
      ? "good"
      : entry.result === "loss"
        ? "bad"
        : entry.result === "push"
          ? "warn"
          : "muted";

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="mono text-[10px] uppercase text-[var(--fg-dim)]">
            {new Date(entry.createdAt).toLocaleString()} · {entry.platform} ·{" "}
            {entry.sport}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <Badge tone={tone}>{entry.result}</Badge>
            {entry.stake !== undefined ? (
              <span className="mono text-xs text-[var(--fg-muted)]">
                stake {entry.stake}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {(["win", "loss", "push", "pending"] as const).map((r) => (
            <Button
              key={r}
              size="sm"
              variant={entry.result === r ? "default" : "secondary"}
              onClick={() => onResult(r)}
            >
              {r}
            </Button>
          ))}
          <Button size="sm" variant="ghost" onClick={onRemove}>
            Delete
          </Button>
        </div>
      </CardHeader>
      <CardBody className="space-y-2">
        {entry.legs.map((leg) => (
          <div
            key={leg.id}
            className="flex items-center justify-between gap-2 border-t border-[var(--border)]/50 pt-2 text-sm first:border-0 first:pt-0"
          >
            <div>
              <span className="mono mr-2 text-[10px] uppercase text-[var(--accent)]">
                {leg.side}
              </span>
              {leg.title}
              {leg.line !== undefined ? (
                <span className="text-[var(--fg-dim)]"> · {leg.line}</span>
              ) : null}
            </div>
            <span className="mono text-xs text-[var(--fg-dim)]">
              {leg.confidence}
            </span>
          </div>
        ))}
        {entry.notes ? (
          <p className="text-xs text-[var(--fg-dim)]">{entry.notes}</p>
        ) : null}
      </CardBody>
    </Card>
  );
}