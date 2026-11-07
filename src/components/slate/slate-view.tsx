"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatKickoffShort, gameGroupKey } from "@/lib/format";
import { useManualProps } from "@/lib/hooks/use-local-store";
import type { LeagueFilter, Side, SlateItem, SourceStatus, Sport } from "@/lib/types";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

const FILTERS: { value: LeagueFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "nba", label: "NBA" },
  { value: "epl", label: "EPL" },
  { value: "la_liga", label: "La Liga" },
  { value: "polymarket", label: "Polymarket" },
];

type SortMode = "edge" | "time" | "confidence" | "game";
type ViewMode = "list" | "byGame";

export function SlateView() {
  const [filter, setFilter] = useState<LeagueFilter>("all");
  const [items, setItems] = useState<SlateItem[]>([]);
  const [statuses, setStatuses] = useState<SourceStatus[]>([]);
  const [detail, setDetail] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sport, setSport] = useState<Sport>("nba");
  const [league, setLeague] = useState("NBA");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("edge");
  const [view, setView] = useState<ViewMode>("byGame");
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
            ? "Slate timed out — try NBA/EPL filter or paste fewer lines."
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

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = items.filter((item) => {
      if (!q) return true;
      const blob = [
        item.title,
        item.subtitle,
        item.league,
        item.platform,
        item.gameKey,
        item.match?.homeTeam,
        item.match?.awayTeam,
        item.prop?.playerName,
        item.prop?.team,
        item.prop?.opponent,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });

    list = [...list].sort((a, b) => {
      if (sort === "edge") return (b.edge ?? -999) - (a.edge ?? -999);
      if (sort === "confidence")
        return (b.confidence ?? 0) - (a.confidence ?? 0);
      if (sort === "time") {
        const ta = a.startTime ? Date.parse(a.startTime) : Number.MAX_SAFE_INTEGER;
        const tb = b.startTime ? Date.parse(b.startTime) : Number.MAX_SAFE_INTEGER;
        return ta - tb;
      }
      // game
      return (a.gameKey ?? a.title).localeCompare(b.gameKey ?? b.title);
    });
    return list;
  }, [items, query, sort]);

  const grouped = useMemo(() => {
    const map = new Map<string, SlateItem[]>();
    for (const item of visible) {
      const key = item.gameKey ?? gameGroupKey(item);
      const arr = map.get(key) ?? [];
      arr.push(item);
      map.set(key, arr);
    }
    // sort groups by earliest kickoff then name
    return [...map.entries()].sort((a, b) => {
      const ta = Math.min(
        ...a[1].map((i) =>
          i.startTime ? Date.parse(i.startTime) : Number.MAX_SAFE_INTEGER,
        ),
      );
      const tb = Math.min(
        ...b[1].map((i) =>
          i.startTime ? Date.parse(i.startTime) : Number.MAX_SAFE_INTEGER,
        ),
      );
      if (ta !== tb) return ta - tb;
      return a[0].localeCompare(b[0]);
    });
  }, [visible]);

  return (
    <div className="fade-in space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="mono text-2xl tracking-tight text-[var(--fg)]">
            Tonight&apos;s slate
          </h1>
          <p className="mt-1 max-w-xl text-sm text-[var(--fg-muted)]">
            Search and group by game. Times are America/Chicago. Open a dossier
            for the fan take + full scorecard.
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
          <Button
            size="sm"
            variant="outline"
            onClick={() => void load()}
            disabled={loading}
          >
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

      <div className="grid gap-2 md:grid-cols-[1fr_auto_auto_auto]">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search team, player, league…"
        />
        <Select
          className="w-full md:w-36"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortMode)}
        >
          <option value="edge">Sort: edge</option>
          <option value="time">Sort: kickoff</option>
          <option value="confidence">Sort: confidence</option>
          <option value="game">Sort: game name</option>
        </Select>
        <Select
          className="w-full md:w-36"
          value={view}
          onChange={(e) => setView(e.target.value as ViewMode)}
        >
          <option value="byGame">View: by game</option>
          <option value="list">View: flat list</option>
        </Select>
        <div className="mono self-center text-xs text-[var(--fg-dim)]">
          {visible.length} shown
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mono text-xs uppercase tracking-wider text-[var(--accent)]">
                Manual PrizePicks paste
              </div>
              <p className="text-xs text-[var(--fg-dim)]">
                <span className="mono">
                  Player | STAT | 22.5 | over | home
                </span>{" "}
                (home/away optional but helps a lot)
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
            placeholder={
              "Jayson Tatum | Points | 27.5 | over | home\nMohamed Salah | Shots on Target | 1.5 | over | home"
            }
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

      {!loading && visible.length === 0 ? (
        <Card>
          <CardBody className="space-y-2">
            <div className="text-sm text-[var(--fg-muted)]">
              Nothing matched. Try another filter, clear search, or paste
              PrizePicks lines above. EPL/La Liga fixtures come from ESPN when
              books aren’t on the free odds tier.
            </div>
          </CardBody>
        </Card>
      ) : null}

      {view === "list" ? (
        <div className="grid gap-2">
          {visible.map((item) => (
            <SlateRow key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([game, rows]) => {
            const kickoff = rows
              .map((r) => r.startTime)
              .filter(Boolean)
              .sort()[0];
            return (
              <Card key={game}>
                <CardHeader className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-sm font-medium">{game}</div>
                    <div className="mono text-[11px] text-[var(--fg-dim)]">
                      {formatKickoffShort(kickoff)} · {rows.length} market
                      {rows.length === 1 ? "" : "s"}
                    </div>
                  </div>
                  <Badge tone="muted">{rows[0]?.league}</Badge>
                </CardHeader>
                <CardBody className="space-y-2 !pt-0">
                  {rows.map((item) => (
                    <SlateRow key={item.id} item={item} compact />
                  ))}
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SlateRow({
  item,
  compact,
}: {
  item: SlateItem;
  compact?: boolean;
}) {
  return (
    <Link
      href={`/dossier?id=${encodeURIComponent(item.id)}`}
      onClick={() => {
        sessionStorage.setItem(
          `formcast.item.${item.id}`,
          JSON.stringify(item),
        );
      }}
      className={
        compact
          ? "group block rounded-md border border-[var(--border)]/70 bg-[var(--panel-2)] px-3 py-2 transition-colors hover:border-[var(--accent)]/40"
          : "group block rounded-lg border border-[var(--border)] bg-[var(--panel)] px-4 py-3 transition-colors hover:border-[var(--accent)]/40 hover:bg-[var(--panel-2)]"
      }
    >
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mono text-[10px] uppercase text-[var(--fg-dim)]">
              {item.platform} · {item.league}
            </span>
            {item.startTime ? (
              <Badge tone="muted">{formatKickoffShort(item.startTime)}</Badge>
            ) : null}
            {item.homeAway ? (
              <Badge tone="accent">{item.homeAway}</Badge>
            ) : null}
            {item.stinker ? <Badge tone="warn">stinker</Badge> : null}
            {item.l5Sample ? (
              <Badge tone={item.l5Hits === item.l5Sample ? "good" : "muted"}>
                L5 {item.l5Hits}/{item.l5Sample}
              </Badge>
            ) : null}
            <SideBadge side={item.recommendedSide} />
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
                  item.edge > 0 ? "text-[var(--good)]" : "text-[var(--fg-muted)]"
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
  );
}

function SideBadge({ side }: { side?: Side | "pass" }) {
  if (!side || side === "pass") return <Badge tone="muted">pass</Badge>;
  return <Badge tone="accent">{side}</Badge>;
}
