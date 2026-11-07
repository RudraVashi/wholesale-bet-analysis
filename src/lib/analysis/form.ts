import { round } from "@/lib/utils";
import type {
  FormWindow,
  GameLog,
  LastFive,
  NextGameAfterStreak,
  Side,
} from "@/lib/types";

/** Same hit rule as L10: over means strictly above the line. A push misses. */
export function clearedLine(
  value: number,
  line: number,
  side: "over" | "under",
): boolean {
  return side === "under" ? value < line : value > line;
}

function asOverUnder(side: Side | "over" | "under" | undefined): "over" | "under" {
  return side === "under" ? "under" : "over";
}

/** Newest five games. `logs[0]` is the most recent game we have, not tonight. */
export function lastFive(
  logs: GameLog[],
  line: number,
  side: Side = "over",
): LastFive {
  const lean = asOverUnder(side);
  const games = logs.slice(0, 5).map((log) => ({
    date: log.date,
    opponent: log.opponent,
    value: log.value,
    hit: clearedLine(log.value, line, lean),
  }));
  const hits = games.filter((game) => game.hit).length;
  return { side: lean, sample: games.length, hits, games };
}

/**
 * For each older game, count hits in the five games before it, then whether
 * that game itself hit. Buckets are prior-hit counts 0 through 5.
 * A bucket with fewer than 3 next games is too thin to lean on.
 */
export function nextGameAfterStreak(
  logs: GameLog[],
  line: number,
  side: Side = "over",
): NextGameAfterStreak {
  const lean = asOverUnder(side);
  const tallies = Array.from({ length: 6 }, () => ({
    nextGames: 0,
    nextHits: 0,
  }));

  for (let i = 0; i + 5 < logs.length; i++) {
    const prior = logs.slice(i + 1, i + 6);
    const priorHits = prior.filter((log) =>
      clearedLine(log.value, line, lean),
    ).length;
    const bucket = tallies[priorHits]!;
    bucket.nextGames += 1;
    if (clearedLine(logs[i]!.value, line, lean)) bucket.nextHits += 1;
  }

  const buckets = tallies.map((tally, priorHits) => ({
    priorHits,
    nextGames: tally.nextGames,
    nextHits: tally.nextHits,
    thin: tally.nextGames < 3,
  }));

  const currentPriorHits = logs.length >= 5 ? lastFive(logs, line, lean).hits : null;
  const matching =
    currentPriorHits == null ? undefined : buckets[currentPriorHits];

  return {
    currentPriorHits,
    buckets,
    matching,
    summary: streakSummary(currentPriorHits, matching),
  };
}

function streakSummary(
  currentPriorHits: number | null,
  matching: NextGameAfterStreak["matching"],
): string {
  if (currentPriorHits == null || !matching) {
    return "Fewer than 5 recent games on file, so there is no full last-5 to compare with the next game.";
  }
  if (matching.nextGames === 0) {
    return `Last 5 are ${currentPriorHits}/5. This log never shows a game played right after a ${currentPriorHits}/5 run.`;
  }
  if (matching.thin) {
    return `Last 5 are ${currentPriorHits}/5. The next game after a ${currentPriorHits}/5 run shows up ${matching.nextGames} time${matching.nextGames === 1 ? "" : "s"} here — too few to lean on.`;
  }
  return `Last 5 are ${currentPriorHits}/5. In this log, the game after a ${currentPriorHits}/5 run hit ${matching.nextHits} of ${matching.nextGames}.`;
}

function median(nums: number[]) {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

export function computeFormWindow(
  logs: GameLog[],
  line: number,
  side: Side = "over",
  window: 10 | 20,
): FormWindow {
  const slice = logs.slice(0, window);
  const values = slice.map((l) => l.value);
  const hits = slice.filter((l) =>
    side === "under" ? l.value < line : l.value > line,
  ).length;
  const sample = slice.length;
  return {
    window,
    sample,
    hits,
    hitRate: sample ? hits / sample : 0,
    avg: sample ? values.reduce((a, b) => a + b, 0) / sample : 0,
    median: median(values),
    logs: slice,
  };
}

/** Score 0-100 favoring the side with better hit rate; lean from L10/L20 blend. */
export function formFactor(
  logs: GameLog[],
  line: number,
  preferredSide?: Side,
): {
  score: number;
  lean: "over" | "under" | "neutral";
  why: string;
  l10: FormWindow;
  l20: FormWindow;
} {
  const overL10 = computeFormWindow(logs, line, "over", 10);
  const overL20 = computeFormWindow(logs, line, "over", 20);
  const underL10 = computeFormWindow(logs, line, "under", 10);
  const underL20 = computeFormWindow(logs, line, "under", 20);

  const overBlend = overL10.hitRate * 0.6 + overL20.hitRate * 0.4;
  const underBlend = underL10.hitRate * 0.6 + underL20.hitRate * 0.4;

  let lean: "over" | "under" | "neutral" = "neutral";
  if (overBlend - underBlend > 0.05) lean = "over";
  else if (underBlend - overBlend > 0.05) lean = "under";

  if (preferredSide === "over" || preferredSide === "under") {
    lean = preferredSide;
  }

  const hit = lean === "under" ? underBlend : overBlend;
  const edge = Math.abs(overBlend - 0.5);
  const samplePenalty = Math.min(overL10.sample, overL20.sample) < 5 ? 15 : 0;
  const score = Math.round(
    Math.max(0, Math.min(100, hit * 100 - samplePenalty + edge * 20)),
  );

  const l10 = lean === "under" ? underL10 : overL10;
  const l20 = lean === "under" ? underL20 : overL20;

  return {
    score,
    lean,
    why: `L10 ${round(l10.hitRate * 100)}% (${l10.hits}/${l10.sample}) · L20 ${round(l20.hitRate * 100)}% · avg ${round(l10.avg)} vs ${line}`,
    l10,
    l20,
  };
}