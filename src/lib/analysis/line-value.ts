import { clamp, round } from "@/lib/utils";

/** For props: model hit rate vs 50% coin-flip fair. */
export function propLineValue(hitRate: number, lean: "over" | "under" | "neutral") {
  const edge = hitRate - 0.5;
  const score = clamp(Math.round(50 + edge * 120));
  return {
    score,
    lean: lean === "neutral" ? ("neutral" as const) : lean,
    why:
      lean === "neutral"
        ? "No clear edge vs the number"
        : `${round(edge * 100, 1)}pt hit-rate edge on ${lean}`,
  };
}

/** For match markets: model lean vs implied probability. */
export function matchLineValue(
  modelHome: number,
  impliedHome: number,
  impliedAway: number,
) {
  const modelAway = 1 - modelHome;
  const homeEdge = modelHome - impliedHome;
  const awayEdge = modelAway - impliedAway;
  const lean =
    homeEdge > awayEdge && homeEdge > 0.03
      ? ("home" as const)
      : awayEdge > homeEdge && awayEdge > 0.03
        ? ("away" as const)
        : ("neutral" as const);
  const edge = Math.max(homeEdge, awayEdge);
  return {
    score: clamp(Math.round(50 + edge * 200)),
    lean,
    why:
      lean === "neutral"
        ? `Model ~${round(modelHome * 100)}% home vs market ${round(impliedHome * 100)}%`
        : `${lean} edge ${round(edge * 100, 1)}pts vs market`,
  };
}