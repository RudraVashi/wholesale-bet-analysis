import type { GameLog } from "@/lib/types";
import { clamp, round } from "@/lib/utils";

export function performanceFactor(logs: GameLog[], line: number) {
  if (logs.length === 0) {
    return {
      score: 40,
      lean: "neutral" as const,
      why: "No season sample yet",
      details: [] as string[],
    };
  }
  const values = logs.map((l) => l.value);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((s, v) => s + (v - avg) ** 2, 0) / Math.max(values.length, 1);
  const std = Math.sqrt(variance);
  const delta = avg - line;
  const consistency = std < line * 0.25 ? 8 : std > line * 0.45 ? -8 : 0;

  let score = 50 + delta * 4 + consistency;
  const lean =
    delta > 0.75 ? ("over" as const) : delta < -0.75 ? ("under" as const) : ("neutral" as const);

  const why = `Season avg ${round(avg)} vs line ${line} (Δ ${round(delta)})`;
  const details = [`Volatility σ=${round(std)} over ${logs.length} games`];

  return {
    score: clamp(Math.round(score)),
    lean,
    why,
    details,
  };
}