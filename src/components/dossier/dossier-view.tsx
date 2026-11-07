"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { formatKickoff } from "@/lib/format";
import { useBuilderLegs } from "@/lib/hooks/use-local-store";
import type { PowerLeg, Scorecard, Side, SlateItem } from "@/lib/types";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

function leanTone(lean: string) {
  if (lean === "over" || lean === "home") return "good" as const;
  if (lean === "under" || lean === "away") return "warn" as const;
  return "muted" as const;
}

export function DossierView() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const router = useRouter();
  const { addLeg, legs } = useBuilderLegs();
  const [item, setItem] = useState<SlateItem | null>(null);
  const [scorecard, setScorecard] = useState<Scorecard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const raw = sessionStorage.getItem(`formcast.item.${id}`);
    if (!raw) {
      setError("Slate item missing — go back and open from the slate.");
      setLoading(false);
      return;
    }
    const parsed = JSON.parse(raw) as SlateItem;
    setItem(parsed);

    async function run() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/dossier", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: parsed.kind,
            prop: parsed.prop,
            match: parsed.match,
            withOffPitch: true,
          }),
        });
        if (!res.ok) throw new Error(`Dossier HTTP ${res.status}`);
        const json = (await res.json()) as { scorecard: Scorecard };
        setScorecard(json.scorecard);
        sessionStorage.setItem(
          `formcast.scorecard.${json.scorecard.id}`,
          JSON.stringify(json.scorecard),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Analysis failed");
      } finally {
        setLoading(false);
      }
    }
    void run();
  }, [id]);

  const formLogs = useMemo(() => {
    return scorecard?.formL20?.logs ?? scorecard?.formL10?.logs ?? [];
  }, [scorecard]);

  function addToPower() {
    if (!scorecard || scorecard.recommendedSide === "pass") return;
    const leg: PowerLeg = {
      id: scorecard.id,
      scorecardId: scorecard.id,
      title: scorecard.title,
      subtitle: scorecard.subtitle,
      side: scorecard.recommendedSide as Side,
      line: scorecard.line,
      sport: scorecard.sport,
      team: scorecard.prop?.team,
      gameId: scorecard.prop?.gameId ?? scorecard.match?.id,
      composite: scorecard.composite,
      confidence: scorecard.confidence,
      stinker: scorecard.stinker,
    };
    addLeg(leg);
    router.push("/builder");
  }

  if (!id) {
    return (
      <Card>
        <CardBody>
          No dossier selected. <Link href="/" className="text-[var(--accent)]">Back to slate</Link>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="fade-in space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <Link href="/" className="mono text-[11px] text-[var(--fg-dim)] hover:text-[var(--accent)]">
            ← slate
          </Link>
          <h1 className="mt-1 text-2xl font-medium tracking-tight">
            {item?.title ?? "Dossier"}
          </h1>
          <p className="text-sm text-[var(--fg-muted)]">{item?.subtitle}</p>
          <p className="mono mt-1 text-xs text-[var(--accent)]">
            {formatKickoff(
              scorecard?.startTime ?? item?.startTime ?? item?.match?.startTime,
            )}
            {item?.homeAway || scorecard?.prop?.homeAway
              ? ` · ${item?.homeAway ?? scorecard?.prop?.homeAway}`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => router.push("/glossary")}
          >
            Glossary
          </Button>
          <Button
            onClick={addToPower}
            disabled={
              !scorecard ||
              scorecard.recommendedSide === "pass" ||
              legs.length >= 4
            }
          >
            Add to Power ({legs.length}/4)
          </Button>
        </div>
      </div>

      {loading ? (
        <Card>
          <CardBody className="mono text-sm text-[var(--fg-dim)]">
            Running wholesale form · dynamics · performance · off-pitch…
          </CardBody>
        </Card>
      ) : null}

      {error ? (
        <Card className="border-[var(--danger)]/40">
          <CardBody className="text-sm text-[var(--danger)]">{error}</CardBody>
        </Card>
      ) : null}

      {scorecard ? (
        <>
          {scorecard.fanTake ? (
            <Card className="border-[var(--accent)]/30">
              <CardHeader>
                <div className="mono text-xs uppercase tracking-wider text-[var(--accent)]">
                  Fan take — plain English
                </div>
              </CardHeader>
              <CardBody className="space-y-2">
                <p className="text-base font-medium">{scorecard.fanTake.headline}</p>
                <ul className="space-y-1 text-sm text-[var(--fg-muted)]">
                  {scorecard.fanTake.bullets.map((b) => (
                    <li key={b}>· {b}</li>
                  ))}
                </ul>
                <p className="text-sm text-[var(--fg)]">
                  {scorecard.fanTake.bottomLine}
                </p>
                <p className="text-[11px] text-[var(--fg-dim)]">
                  Confused by a word?{" "}
                  <Link href="/glossary" className="text-[var(--accent)]">
                    Open the glossary
                  </Link>
                  .
                </p>
              </CardBody>
            </Card>
          ) : null}

          <div className="grid gap-3 md:grid-cols-4">
            <Card>
              <CardBody>
                <div className="mono text-[10px] uppercase text-[var(--fg-dim)]">
                  Verdict
                </div>
                <div className="mt-1 text-xl capitalize text-[var(--accent)]">
                  {scorecard.recommendedSide}
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <div className="mono text-[10px] uppercase text-[var(--fg-dim)]">
                  Composite
                </div>
                <div className="mt-1 text-xl">{scorecard.composite}</div>
                <div className="score-bar mt-2">
                  <span style={{ width: `${scorecard.composite}%` }} />
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <div className="mono text-[10px] uppercase text-[var(--fg-dim)]">
                  Confidence
                </div>
                <div className="mt-1 text-xl">{scorecard.confidence}</div>
                <div className="score-bar mt-2">
                  <span style={{ width: `${scorecard.confidence}%` }} />
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <div className="mono text-[10px] uppercase text-[var(--fg-dim)]">
                  Stinker check
                </div>
                <div className="mt-1">
                  {scorecard.stinker ? (
                    <Badge tone="warn">caution</Badge>
                  ) : (
                    <Badge tone="good">clear</Badge>
                  )}
                </div>
                {scorecard.stinkerReason ? (
                  <p className="mt-2 text-xs text-[var(--fg-muted)]">
                    {scorecard.stinkerReason}
                  </p>
                ) : null}
              </CardBody>
            </Card>
          </div>

          {scorecard.dataWarnings.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {scorecard.dataWarnings.map((w) => (
                <Badge key={w} tone="warn">
                  {w}
                </Badge>
              ))}
            </div>
          ) : null}

          <div className="grid gap-3 lg:grid-cols-2">
            {scorecard.factors.map((f) => (
              <Card key={f.key}>
                <CardHeader className="flex items-center justify-between gap-2">
                  <div className="mono text-xs uppercase tracking-wider">
                    {f.label}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={leanTone(f.lean)}>{f.lean}</Badge>
                    <span className="mono text-sm">{f.score}</span>
                  </div>
                </CardHeader>
                <CardBody>
                  <p className="text-sm text-[var(--fg-muted)]">{f.why}</p>
                  {f.details?.length ? (
                    <ul className="mt-2 space-y-1 text-xs text-[var(--fg-dim)]">
                      {f.details.map((d) => (
                        <li key={d}>· {d}</li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="score-bar mt-3">
                    <span style={{ width: `${f.score}%` }} />
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>

          {scorecard.kind === "prop" ? (
            <Card>
              <CardHeader>
                <div className="mono text-xs uppercase tracking-wider text-[var(--accent)]">
                  Last 5
                </div>
              </CardHeader>
              <CardBody className="space-y-3">
                {scorecard.lastFive && scorecard.lastFive.sample > 0 ? (
                  <>
                    <div className="flex flex-wrap items-center gap-3">
                      <div
                        className="flex items-center gap-1.5"
                        aria-label={`Last 5, oldest to newest, ${scorecard.lastFive.hits} of ${scorecard.lastFive.sample} hit`}
                      >
                        {[...scorecard.lastFive.games].reverse().map((game, index) => (
                          <span
                            key={`${game.date}-${index}`}
                            title={`${game.date || "undated"} vs ${game.opponent}: ${game.value}${game.hit ? " hit" : " miss"}`}
                            className={`h-3 w-3 rounded-full ${game.hit ? "bg-[var(--good)]" : "bg-[var(--fg-dim)]"}`}
                          />
                        ))}
                      </div>
                      <div className="mono text-sm">
                        {scorecard.lastFive.hits}/{scorecard.lastFive.sample}
                        <span className="ml-2 text-[var(--fg-dim)]">
                          {scorecard.lastFive.side}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-[var(--fg-dim)]">
                      Oldest on the left, newest on the right. Tonight is not
                      in this strip.
                    </p>
                    {scorecard.nextGame ? (
                      <p className="text-sm text-[var(--fg-muted)]">
                        {scorecard.nextGame.summary}
                      </p>
                    ) : null}
                  </>
                ) : (
                  <p className="text-sm text-[var(--fg-muted)]">
                    No recent games on file for a last-5 read.
                  </p>
                )}
              </CardBody>
            </Card>
          ) : null}

          {(scorecard.formL10 || scorecard.formL20) && (
            <Card>
              <CardHeader>
                <div className="mono text-xs uppercase tracking-wider text-[var(--accent)]">
                  Wholesale windows
                </div>
              </CardHeader>
              <CardBody className="grid gap-4 md:grid-cols-2">
                {scorecard.formL10 ? (
                  <div>
                    <div className="mono text-sm">
                      L10 · {Math.round(scorecard.formL10.hitRate * 100)}% (
                      {scorecard.formL10.hits}/{scorecard.formL10.sample})
                    </div>
                    <div className="text-xs text-[var(--fg-dim)]">
                      avg {scorecard.formL10.avg.toFixed(1)} · median{" "}
                      {scorecard.formL10.median.toFixed(1)}
                    </div>
                  </div>
                ) : null}
                {scorecard.formL20 ? (
                  <div>
                    <div className="mono text-sm">
                      L20 · {Math.round(scorecard.formL20.hitRate * 100)}% (
                      {scorecard.formL20.hits}/{scorecard.formL20.sample})
                    </div>
                    <div className="text-xs text-[var(--fg-dim)]">
                      avg {scorecard.formL20.avg.toFixed(1)} · median{" "}
                      {scorecard.formL20.median.toFixed(1)}
                    </div>
                  </div>
                ) : null}
              </CardBody>
            </Card>
          )}

          {formLogs.length > 0 ? (
            <Card>
              <CardHeader>
                <div className="mono text-xs uppercase tracking-wider">
                  Recent logs
                </div>
              </CardHeader>
              <CardBody className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="mono text-[var(--fg-dim)]">
                    <tr>
                      <th className="pb-2 pr-3 font-medium">Date</th>
                      <th className="pb-2 pr-3 font-medium">Opp</th>
                      <th className="pb-2 pr-3 font-medium">H/A</th>
                      <th className="pb-2 font-medium">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formLogs.map((l, i) => {
                      const hit =
                        scorecard.line !== undefined &&
                        (scorecard.recommendedSide === "under"
                          ? l.value < scorecard.line
                          : l.value > scorecard.line);
                      return (
                        <tr
                          key={`${l.date}-${i}`}
                          className="border-t border-[var(--border)]/60"
                        >
                          <td className="py-1.5 pr-3 mono">{l.date || "—"}</td>
                          <td className="py-1.5 pr-3">{l.opponent}</td>
                          <td className="py-1.5 pr-3">
                            {l.home ? "H" : "A"}
                          </td>
                          <td
                            className={`py-1.5 mono ${hit ? "text-[var(--good)]" : "text-[var(--fg-muted)]"}`}
                          >
                            {l.value}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardBody>
            </Card>
          ) : null}

          {scorecard.offPitch ? (
            <Card>
              <CardHeader className="flex items-center justify-between">
                <div className="mono text-xs uppercase tracking-wider text-[var(--accent)]">
                  Off-pitch
                </div>
                <Badge
                  tone={
                    scorecard.offPitch.severity === "high"
                      ? "bad"
                      : scorecard.offPitch.severity === "medium"
                        ? "warn"
                        : "muted"
                  }
                >
                  {scorecard.offPitch.severity}
                </Badge>
              </CardHeader>
              <CardBody>
                <p className="text-sm">{scorecard.offPitch.summary}</p>
                <ul className="mt-3 space-y-1 text-sm text-[var(--fg-muted)]">
                  {scorecard.offPitch.bullets.map((b) => (
                    <li key={b}>· {b}</li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  );
}