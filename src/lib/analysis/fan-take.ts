import { formatKickoff } from "@/lib/format";
import { round } from "@/lib/utils";
import type { Scorecard } from "@/lib/types";

/** Plain-English summary for people who don't want the jargon. */
export function buildFanTake(sc: Scorecard): {
  headline: string;
  bullets: string[];
  bottomLine: string;
} {
  const side = sc.recommendedSide;
  const dynamics = sc.factors.find((f) => f.key === "form");
  const homeFactor = sc.factors.find((f) => f.key === "dynamics");
  const off = sc.factors.find((f) => f.key === "offpitch");
  const bullets: string[] = [];

  if (sc.kind === "prop" && sc.formL10 && sc.line !== undefined) {
    const w = sc.formL10;
    const cleared = side === "under" ? "stayed under" : "went over";
    bullets.push(
      `In the last ${w.sample || 10} games we have, this player ${cleared} the ${sc.line} line ${w.hits} time${w.hits === 1 ? "" : "s"} (${round(w.hitRate * 100)}%).`,
    );
    bullets.push(
      `Their recent average is about ${round(w.avg)} — compare that to the number ${sc.line}.`,
    );
    if (sc.lastFive && sc.lastFive.sample > 0 && sc.nextGame) {
      bullets.push(sc.nextGame.consecutive.summary);
      bullets.push(sc.nextGame.lastFiveCount.summary);
    }
  }

  if (sc.kind === "match" && sc.match) {
    bullets.push(
      `This is ${sc.match.awayTeam} visiting ${sc.match.homeTeam}${sc.match.startTime ? ` (${formatKickoff(sc.match.startTime)})` : ""}.`,
    );
    bullets.push(
      `Home teams often get a boost — our home/away read is baked into the “team dynamics” score (${homeFactor?.score ?? "n/a"}).`,
    );
    if (sc.match.impliedHome > 0 && sc.match.homePrice !== 0) {
      bullets.push(
        `The market currently prices home around ${round(sc.match.impliedHome * 100)}% and away around ${round(sc.match.impliedAway * 100)}%.`,
      );
    } else {
      bullets.push(
        `No sportsbook price on this row yet — treat it as a form/news check, not a locked odds play.`,
      );
    }
  }

  if (homeFactor?.details?.length) {
    bullets.push(`Home/away & schedule: ${homeFactor.details[0]}`);
  }

  if (off?.why && !off.why.toLowerCase().includes("add gemini")) {
    bullets.push(`Off the field / court: ${off.why}`);
  } else if (off?.why?.toLowerCase().includes("add gemini")) {
    bullets.push(
      `Off-pitch news isn’t loaded (needs a Gemini key) — so we’re mostly going off the numbers.`,
    );
  }

  if (sc.stinker) {
    bullets.push(
      `Stinker warning: this looks thin or messy — easy to force a bad bet.`,
    );
  }

  let headline: string;
  if (side === "pass") {
    headline = "Plain take: I’d skip this one.";
  } else if (sc.kind === "prop") {
    headline = `Plain take: lean ${side.toUpperCase()} ${sc.line ?? ""}`.trim();
  } else {
    headline = `Plain take: lean ${side === "home" ? "the home team" : side === "away" ? "the away team" : side}.`;
  }

  const confWord =
    sc.confidence >= 70
      ? "fairly confident"
      : sc.confidence >= 55
        ? "mildly confident"
        : "not very confident";

  const bottomLine =
    side === "pass"
      ? `Bottom line: pass. Edge looks weak (confidence ${sc.confidence} — ${confWord}).`
      : `Bottom line: ${side} if you’re playing it — confidence ${sc.confidence} (${confWord}). Overall desk score ${sc.composite}/100.${dynamics ? ` Form score ${dynamics.score}.` : ""}`;

  return { headline, bullets, bottomLine };
}