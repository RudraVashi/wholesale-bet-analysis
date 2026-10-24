"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useManualProps } from "@/lib/hooks/use-local-store";
import type { LeagueFilter, SlateItem, SourceStatus, Sport } from "@/lib/types";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const FILTERS: { value: LeagueFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "nba", label: "NBA" },
  { value: "epl", label: "EPL" },
  { value: "la_liga", label: "La Liga" },
  { value: "polymarket", label: "Polymarket" },
];

export function SlateView() {
  const [filter, setFilter] = useState<LeagueFilter>("all");
  const [items, setItems] = useState<SlateItem[]>([]);
  const [statuses, setStatuses] = useState<SourceStatus[]>([]);
  const [detail, setDetail] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sport, setSport] = useState<Sport>("nba");
  const [league, setLeague] = useState("NBA");
  const manual = useManualProps();

  const load = useCallback(
    async (manualText?: string) => {
      setLoading(true);
      setError(null);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 45000);
      try {
        const res = await fetch("/api/slate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filter,
            manualText: manualText ?? manual.text,
            sport,
            league,
          }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Slate HTTP ${res.status}`);
        const json = (await res.json()) as {
          items: SlateItem[];
          statuses: SourceStatus[];
          detail: string;
        };
        setItems(json.items);
        setStatuses(json.statuses);
        setDetail(json.detail);
      } catch (err) {
        const message =
          err instanceof Error && err.name === "AbortError"
            ? "Slate timed out — try NBA filter or paste fewer lines."
            : err instanceof Error
              ? err.message
              : "Failed to load slate";
        setError(message);
      } finally {
        clearTimeout(timer);
        setLoading(false);
      }
    },
    [filter, manual.text, sport, league],
  );

  useEffect(() => {
    if (!manual.ready) return;
    void load();
  }, [manual.ready, filter, load]);

  return (
    <div className="fade-in space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="mono text-2xl tracking-tight text-[var(--fg)]">
            Tonight&apos;s slate
          </h1>
          <p className="mt-1 max-w-xl text-sm text-[var(--fg-muted)]">
            Ranked by wholesale edge. PrizePicks props + Polymarket winners.
            Open a dossier for the full scorecard.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <Button
              key={f.value}
              size="sm"
              variant={filter === f.value ? "default" : "secondary"}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </Button>
          ))}
          <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
            {loading ? "Scanning…" : "Refresh"}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {statuses.map((s) => (
          <Badge key={s.key} tone={s.ok ? "good" : "warn"}>
            {s.label}: {s.ok ? "up" : "down"}
          </Badge>
        ))}
      </div>
      {detail ? (
        <p className="mono text-[11px] text-[var(--fg-dim)]">{detail}</p>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mono text-xs uppercase tracking-wider text-[var(--accent)]">
                Manual PrizePicks paste
              </div>
              <p className="text-xs text-[var(--fg-dim)]">
                One per line: <span className="mono">Player | STAT | 22.5 | over</span>
              </p>
            </div>
            <div className="flex gap-2">
              <Select
                className="w-28"
                value={sport}
                onChange={(e) => {
                  const s = e.target.value as Sport;
                  setSport(s);
                  setLeague(s === "nba" ? "NBA" : "EPL");
                }}
              >
                <option value="nba">NBA</option>
                <option value="soccer">Soccer</option>
              </Select>
              <Select
                className="w-32"
                value={league}
                onChange={(e) => setLeague(e.target.value)}
              >
                {sport === "nba" ? (
                  <option value="NBA">NBA</option>
                ) : (
                  <>
                    <option value="EPL">EPL</option>
                    <option value="La Liga">La Liga</option>
                  </>
                )}
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardBody className="space-y-3">
          <Textarea
            value={manual.text}
            onChange={(e) => manual.setText(e.target.value)}
            placeholder={"Jayson Tatum | Points | 27.5 | over\nMohamed Salah | Shots on Target | 1.5 | over"}
          />
          <Button
            onClick={() => void load(manual.text)}
            disabled={loading || !manual.text.trim()}
          >
            Analyze pasted lines
          </Button>
        </CardBody>
      </Card>

      {error ? (
        <Card className="border-[var(--danger)]/40">
          <CardBody className="text-sm text-[var(--danger)]">{error}</CardBody>
        </Card>
      ) : null}

      {loading && items.length === 0 ? (
        <Card>
          <CardBody className="mono text-sm text-[var(--fg-dim)]">
            Pulling boards and running L10/L20 form…
          </CardBody>
        </Card>
      ) : null}

      {!loading && items.length === 0 ? (
        <Card>
          <CardBody className="space-y-2">
            <div className="text-sm text-[var(--fg-muted)]">
              Empty slate. PrizePicks may be blocked from this IP, or markets are
              closed. Paste lines above to analyze.
            </div>
          </CardBody>
        </Card>
      ) : null}

      <div className="grid gap-2">
        {items.map((item) => (
          <Link
            key={item.id}
            href={`/dossier?id=${encodeURIComponent(item.id)}`}
            onClick={() => {
              sessionStorage.setItem(
                `formcast.item.${item.id}`,
                JSON.stringify(item),
              );
            }}
            className="group block rounded-lg border border-[var(--border)] bg-[var(--panel)] px-4 py-3 transition-colors hover:border-[var(--accent)]/40 hover:bg-[var(--panel-2)]"
          >
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mono text-[10px] uppercase text-[var(--fg-dim)]">
                    {item.platform} · {item.league}
                  </span>
                  {item.stinker ? <Badge tone="warn">stinker check</Badge> : null}
                  {item.recommendedSide && item.recommendedSide !== "pass" ? (
                    <Badge tone="accent">{item.recommendedSide}</Badge>
                  ) : (
                    <Badge tone="muted">pass</Badge>
                  )}
                </div>
                <div className="mt-1 truncate text-sm font-medium group-hover:text-[var(--accent)]">
                  {item.title}
                </div>
                <div className="text-xs text-[var(--fg-dim)]">{item.subtitle}</div>
              </div>
              <div className="flex items-center gap-4 mono text-xs">
                {typeof item.edge === "number" ? (
                  <div className="text-right">
                    <div className="text-[var(--fg-dim)]">edge</div>
                    <div
                      className={
                        item.edge > 0
                          ? "text-[var(--good)]"
                          : "text-[var(--fg-muted)]"
                      }
                    >
                      {item.edge > 0 ? "+" : ""}
                      {item.edge}
                    </div>
                  </div>
                ) : null}
                {typeof item.composite === "number" ? (
                  <div className="text-right">
                    <div className="text-[var(--fg-dim)]">score</div>
                    <div>{item.composite}</div>
                  </div>
                ) : null}
                {typeof item.confidence === "number" ? (
                  <div className="w-16 text-right">
                    <div className="text-[var(--fg-dim)]">conf</div>
                    <div>{item.confidence}</div>
                    <div className="score-bar mt-1">
                      <span style={{ width: `${item.confidence}%` }} />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}