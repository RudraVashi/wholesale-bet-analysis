import { dynamicsFactor } from "@/lib/analysis/dynamics";
import { buildFanTake } from "@/lib/analysis/fan-take";
import { formFactor, lastFive, nextGameAfterStreak } from "@/lib/analysis/form";
import { matchLineValue, propLineValue } from "@/lib/analysis/line-value";
import { performanceFactor } from "@/lib/analysis/performance";
import { clamp, round } from "@/lib/utils";
import type {
  FactorScore,
  GameLog,
  MatchMarket,
  OffPitchDigest,
  PropLine,
  Scorecard,
  Side,
} from "@/lib/types";

function contrarianFactor(
  formLean: string,
  offPitch?: OffPitchDigest,
): FactorScore {
  if (!offPitch || offPitch.lean === "neutral" || formLean === "neutral") {
    return {
      key: "contrarian",
      label: "Contrarian",
      score: 50,
      lean: "neutral",
      why: "Numbers and narrative aligned (or thin)",
    };
  }
  const diverge = offPitch.lean !== formLean;
  return {
    key: "contrarian",
    label: "Contrarian",
    score: diverge ? 72 : 45,
    lean: diverge ? (formLean as FactorScore["lean"]) : "neutral",
    why: diverge
      ? `Narrative leans ${offPitch.lean} while form leans ${formLean}`
      : "Narrative agrees with form",
  };
}

export function buildPropScorecard(input: {
  prop: PropLine;
  logs: GameLog[];
  offPitch?: OffPitchDigest;
  warnings?: string[];
}): Scorecard {
  const { prop, logs, offPitch } = input;
  const warnings = [...(input.warnings ?? [])];
  if (logs.length === 0) warnings.push("No wholesale game logs — confidence capped.");

  const form = formFactor(logs, prop.line, prop.side);
  const streakSide =
    prop.side === "under" || prop.side === "over"
      ? prop.side
      : form.lean === "under"
        ? "under"
        : "over";
  const recentFive = lastFive(logs, prop.line, streakSide);
  const nextGame = nextGameAfterStreak(logs, prop.line, streakSide);
  const dynamics = dynamicsFactor(logs, prop.homeAway);
  const performance = performanceFactor(logs, prop.line);
  const lineValue = propLineValue(
    form.lean === "under" ? form.l10.hitRate : form.l10.hitRate,
    form.lean,
  );

  const factors: FactorScore[] = [
    {
      key: "form",
      label: "Wholesale form",
      score: form.score,
      lean: form.lean,
      why: form.why,
      details:
        recentFive.sample > 0
          ? [nextGame.consecutive.summary, nextGame.lastFiveCount.summary]
          : undefined,
    },
    {
      key: "dynamics",
      label: "Team dynamics",
      score: dynamics.score,
      lean: dynamics.lean,
      why: dynamics.why,
      details: dynamics.details,
    },
    {
      key: "performance",
      label: "Performance",
      score: performance.score,
      lean: performance.lean,
      why: performance.why,
      details: performance.details,
    },
    {
      key: "offpitch",
      label: "Off-pitch",
      score: offPitch?.score ?? 50,
      lean: offPitch?.lean ?? "neutral",
      why: offPitch?.summary ?? "Off-pitch not loaded yet",
      details: offPitch?.bullets,
    },
    {
      key: "lineValue",
      label: "Line value",
      score: lineValue.score,
      lean: lineValue.lean,
      why: lineValue.why,
    },
    contrarianFactor(form.lean, offPitch),
  ];

  // Dynamics (home/away + rest) is intentionally heavy — venue matters.
  const weights: Record<string, number> = {
    form: 0.34,
    dynamics: 0.22,
    performance: 0.16,
    offpitch: 0.1,
    lineValue: 0.13,
    contrarian: 0.05,
  };

  let composite = 0;
  for (const f of factors) {
    composite += f.score * (weights[f.key] ?? 0);
  }
  composite = clamp(Math.round(composite));

  // Off-pitch veto soft-cap
  if (offPitch?.severity === "high") {
    composite = Math.min(composite, 58);
    warnings.push("High-severity off-pitch news soft-capped confidence.");
  }

  const leanVotes = { over: 0, under: 0 };
  for (const f of factors) {
    if (f.lean === "over") leanVotes.over += weights[f.key] ?? 0;
    if (f.lean === "under") leanVotes.under += weights[f.key] ?? 0;
  }
  let recommendedSide: Side | "pass" =
    leanVotes.over > leanVotes.under + 0.05
      ? "over"
      : leanVotes.under > leanVotes.over + 0.05
        ? "under"
        : "pass";

  if (prop.side === "over" || prop.side === "under") {
    recommendedSide = prop.side;
  }

  const confidence = clamp(
    Math.round(
      composite * 0.7 +
        Math.min(form.l10.sample, 10) * 2 +
        (logs.length >= 10 ? 8 : 0),
    ),
  );

  const edgeThin = Math.abs(form.l10.hitRate - 0.5) < 0.08;
  const stinker =
    recommendedSide === "pass" ||
    confidence < 52 ||
    edgeThin ||
    (offPitch?.severity === "high" && composite < 60);
  const stinkerReason = stinker
    ? recommendedSide === "pass"
      ? "No clear side — pass rather than force it."
      : edgeThin
        ? "Thin wholesale edge — stinker risk if you force the pick."
        : "Confidence too low or off-pitch overhang."
    : undefined;

  if (logs.length < 5) {
    // already may be capped
  }

  if (!prop.homeAway) {
    warnings.push(
      "Home/away not set on this prop — paste “home” or “away” when you can; dynamics is weaker without it.",
    );
  }

  const scorecard: Scorecard = {
    id: `sc-${prop.id}`,
    kind: "prop",
    title: `${prop.playerName} · ${prop.statLabel}`,
    subtitle: `${prop.league} · ${prop.line} · ${prop.platform}${prop.homeAway ? ` · ${prop.homeAway}` : ""}`,
    sport: prop.sport,
    league: prop.league,
    platform: prop.platform,
    line: prop.line,
    side: recommendedSide === "pass" ? prop.side : recommendedSide,
    recommendedSide,
    composite,
    confidence,
    stinker,
    stinkerReason,
    factors,
    formL10: form.l10,
    formL20: form.l20,
    lastFive: recentFive,
    nextGame,
    offPitch,
    prop,
    startTime: prop.startTime,
    generatedAt: new Date().toISOString(),
    dataWarnings: warnings,
  };
  scorecard.fanTake = buildFanTake(scorecard);
  return scorecard;
}

export function buildMatchScorecard(input: {
  match: MatchMarket;
  homeForm?: GameLog[];
  awayForm?: GameLog[];
  offPitch?: OffPitchDigest;
  warnings?: string[];
}): Scorecard {
  const { match, offPitch } = input;
  const homeForm = input.homeForm ?? [];
  const awayForm = input.awayForm ?? [];
  const warnings = [...(input.warnings ?? [])];

  // Goal-diff style form → rough win probs
  const homeAvg =
    homeForm.reduce((s, l) => s + l.value, 0) / Math.max(homeForm.length, 1);
  const awayAvg =
    awayForm.reduce((s, l) => s + l.value, 0) / Math.max(awayForm.length, 1);
  const diff = homeAvg - awayAvg;
  const modelHome = clamp(0.5 + diff * 0.05, 0.15, 0.85);

  const formScore = clamp(Math.round(50 + Math.abs(diff) * 8));
  const formLean = diff > 0.4 ? "home" : diff < -0.4 ? "away" : "neutral";

  const lineValue = matchLineValue(
    modelHome,
    match.impliedHome,
    match.impliedAway,
  );

  // Explicit home-field factor (~3–5% win bump in soccer/NBA range)
  const homeFieldScore = 62;
  const hasBook = match.homePrice !== 0 || match.awayPrice !== 0;
  if (!hasBook) {
    warnings.push(
      "No live sportsbook price on this fixture — fan take uses form/home edge only.",
    );
  }

  const factors: FactorScore[] = [
    {
      key: "form",
      label: "Wholesale form",
      score: formScore,
      lean: formLean,
      why: `Home form proxy ${round(homeAvg)} vs away ${round(awayAvg)} (L${Math.min(homeForm.length, 20)})`,
    },
    {
      key: "dynamics",
      label: "Home / away",
      score: homeFieldScore,
      lean: "home",
      why: `${match.homeTeam} at home vs ${match.awayTeam} on the road`,
      details: [
        "Home sides get a real bump — crowd, travel, refereeing tendencies.",
        "We lean slightly home unless away form is clearly better.",
      ],
    },
    {
      key: "performance",
      label: "Performance",
      score: formScore,
      lean: formLean,
      why: `Model home win ~${round(modelHome * 100)}% (includes home bump)`,
    },
    {
      key: "offpitch",
      label: "Off-pitch",
      score: offPitch?.score ?? 50,
      lean: offPitch?.lean ?? "neutral",
      why: offPitch?.summary ?? "Off-pitch not loaded yet",
      details: offPitch?.bullets,
    },
    {
      key: "lineValue",
      label: "Line value",
      score: hasBook ? lineValue.score : 50,
      lean: hasBook ? lineValue.lean : "neutral",
      why: hasBook ? lineValue.why : "No book line to compare yet",
    },
    contrarianFactor(formLean, offPitch),
  ];

  const weights: Record<string, number> = {
    form: 0.28,
    dynamics: 0.22,
    performance: 0.15,
    offpitch: 0.12,
    lineValue: hasBook ? 0.18 : 0.08,
    contrarian: 0.05,
  };

  const composite = clamp(
    Math.round(
      factors.reduce((s, f) => s + f.score * (weights[f.key] ?? 0), 0),
    ),
  );

  let recommendedSide: Side | "pass" =
    lineValue.lean === "home" || lineValue.lean === "away"
      ? lineValue.lean
      : formLean === "home" || formLean === "away"
        ? formLean
        : "home"; // slight home lean when thin

  if (!hasBook && formLean === "neutral") {
    recommendedSide = "home";
  }

  const confidence = clamp(
    Math.round(
      composite * 0.7 +
        (homeForm.length >= 8 ? 10 : 0) +
        (hasBook ? 8 : 0),
    ),
  );
  const stinker = confidence < 52;

  const scorecard: Scorecard = {
    id: `sc-${match.id}`,
    kind: "match",
    title: `${match.awayTeam} @ ${match.homeTeam}`,
    subtitle: hasBook
      ? `${match.league} · ${match.platform} · H ${round(match.impliedHome * 100)}% / A ${round(match.impliedAway * 100)}%`
      : `${match.league} · ESPN fixture · home lean baked in`,
    sport: match.sport,
    league: match.league,
    platform: match.platform === "polymarket" ? "polymarket" : "sportsbook",
    recommendedSide,
    composite,
    confidence,
    stinker,
    stinkerReason: stinker
      ? "Confidence still low — home lean isn’t a free square."
      : undefined,
    factors,
    offPitch,
    match,
    startTime: match.startTime,
    generatedAt: new Date().toISOString(),
    dataWarnings: warnings,
  };
  scorecard.fanTake = buildFanTake(scorecard);
  return scorecard;
}

export function slateEdgeFromScorecard(sc: Scorecard): number {
  const form = sc.factors.find((f) => f.key === "form");
  const lv = sc.factors.find((f) => f.key === "lineValue");
  return round(((form?.score ?? 50) + (lv?.score ?? 50)) / 2 - 50, 1);
}