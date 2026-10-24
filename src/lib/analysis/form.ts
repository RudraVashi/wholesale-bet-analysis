import { round } from "@/lib/utils";
import type { FormWindow, GameLog, Side } from "@/lib/types";

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