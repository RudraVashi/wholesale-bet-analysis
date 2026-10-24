"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useBuilderLegs, useJournal } from "@/lib/hooks/use-local-store";
import type { JournalEntry } from "@/lib/types";
import Link from "next/link";
import { useMemo, useState } from "react";

export function BuilderView() {
  const { legs, removeLeg, clear } = useBuilderLegs();
  const { addEntry } = useJournal();
  const [stake, setStake] = useState("");
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);

  const correlation = useMemo(() => {
    const warnings: string[] = [];
    const teams = legs.map((l) => l.team).filter(Boolean);
    const games = legs.map((l) => l.gameId).filter(Boolean);
    if (new Set(teams).size < teams.length) {
      warnings.push("Multiple legs share a team — correlated Power risk.");
    }
    if (new Set(games).size < games.length) {
      warnings.push("Same-game stack detected — one swing can sink the entry.");
    }
    if (legs.some((l) => l.stinker)) {
      warnings.push("At least one leg failed the stinker check.");
    }
    return warnings;
  }, [legs]);

  const combined = useMemo(() => {
    if (legs.length === 0) return { composite: 0, confidence: 0 };
    const composite = Math.round(
      legs.reduce((s, l) => s + l.composite, 0) / legs.length,
    );
    const confidence = Math.round(
      legs.reduce((s, l) => s + l.confidence, 0) / legs.length -
        (legs.length - 2) * 4,
    );
    return { composite, confidence: Math.max(0, confidence) };
  }, [legs]);

  function saveToJournal() {
    if (legs.length < 2 || legs.length > 4) return;
    const entry: JournalEntry = {
      id: `j-${Date.now()}`,
      createdAt: new Date().toISOString(),
      platform: "prizepicks",
      sport: legs[0]?.sport ?? "nba",
      legs: [...legs],
      stake: stake ? Number(stake) : undefined,
      result: "pending",
      notes: notes || undefined,
    };
    addEntry(entry);
    setSaved(true);
    clear();
    setStake("");
    setNotes("");
  }

  return (
    <div className="fade-in space-y-5">
      <div>
        <h1 className="mono text-2xl tracking-tight">Power builder</h1>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">
          2–4 legs. Add from a dossier. We flag correlation and thin edges —
          you still place the entry on PrizePicks.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardBody>
            <div className="mono text-[10px] uppercase text-[var(--fg-dim)]">
              Legs
            </div>
            <div className="mt-1 text-xl">
              {legs.length}/4
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="mono text-[10px] uppercase text-[var(--fg-dim)]">
              Combined score
            </div>
            <div className="mt-1 text-xl">{combined.composite || "—"}</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="mono text-[10px] uppercase text-[var(--fg-dim)]">
              Combined conf
            </div>
            <div className="mt-1 text-xl">{combined.confidence || "—"}</div>
          </CardBody>
        </Card>
      </div>

      {correlation.map((w) => (
        <Badge key={w} tone="warn">
          {w}
        </Badge>
      ))}

      {legs.length === 0 ? (
        <Card>
          <CardBody className="text-sm text-[var(--fg-muted)]">
            No legs yet.{" "}
            <Link href="/" className="text-[var(--accent)]">
              Scan the slate
            </Link>
            , open a dossier, and hit Add to Power.
          </CardBody>
        </Card>
      ) : (
        <div className="grid gap-2">
          {legs.map((leg) => (
            <Card key={leg.id}>
              <CardBody className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone="accent">{leg.side}</Badge>
                    {leg.stinker ? <Badge tone="warn">stinker</Badge> : null}
                    <span className="mono text-[10px] text-[var(--fg-dim)]">
                      {leg.sport}
                    </span>
                  </div>
                  <div className="mt-1 text-sm font-medium">{leg.title}</div>
                  <div className="text-xs text-[var(--fg-dim)]">
                    {leg.subtitle}
                    {leg.line !== undefined ? ` · ${leg.line}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="mono text-right text-xs">
                    <div>{leg.composite}</div>
                    <div className="text-[var(--fg-dim)]">conf {leg.confidence}</div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => removeLeg(leg.id)}>
                    Remove
                  </Button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="mono text-xs uppercase tracking-wider text-[var(--accent)]">
            Log entry
          </div>
        </CardHeader>
        <CardBody className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mono text-[10px] uppercase text-[var(--fg-dim)]">
                Stake (optional)
              </label>
              <Input
                value={stake}
                onChange={(e) => setStake(e.target.value)}
                placeholder="25"
                type="number"
                min={0}
              />
            </div>
            <div>
              <label className="mono text-[10px] uppercase text-[var(--fg-dim)]">
                Notes
              </label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Power flex, feeling the overs…"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={saveToJournal}
              disabled={legs.length < 2 || legs.length > 4}
            >
              Save to journal
            </Button>
            <Button variant="secondary" onClick={clear} disabled={legs.length === 0}>
              Clear legs
            </Button>
          </div>
          {saved ? (
            <p className="text-xs text-[var(--good)]">
              Saved. Grade it later in Journal.
            </p>
          ) : null}
          {legs.length > 0 && legs.length < 2 ? (
            <p className="text-xs text-[var(--warn)]">
              Need at least 2 legs for a Power play.
            </p>
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}