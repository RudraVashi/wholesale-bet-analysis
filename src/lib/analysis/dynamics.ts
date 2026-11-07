import type { GameLog } from "@/lib/types";
import { clamp, round } from "@/lib/utils";

function daysBetween(a: string, b: string) {
  const da = Date.parse(a);
  const db = Date.parse(b);
  if (Number.isNaN(da) || Number.isNaN(db)) return null;
  return Math.round(Math.abs(db - da) / 86400000);
}

/**
 * Home/away is a first-class signal here — not a small footnote.
 * When we know the side of the upcoming tip, we weight the matching split hard.
 */
export function dynamicsFactor(logs: GameLog[], homeAway?: "home" | "away") {
  const recent = logs.slice(0, 5);
  const homeLogs = logs.filter((l) => l.home).slice(0, 10);
  const awayLogs = logs.filter((l) => !l.home).slice(0, 10);
  const homeAvg =
    homeLogs.reduce((s, l) => s + l.value, 0) / Math.max(homeLogs.length, 1);
  const awayAvg =
    awayLogs.reduce((s, l) => s + l.value, 0) / Math.max(awayLogs.length, 1);
  const split = homeAvg - awayAvg;

  let restDays: number | null = null;
  if (logs.length >= 2) {
    restDays = daysBetween(logs[0]!.date, logs[1]!.date);
  }
  const backToBack = restDays !== null && restDays <= 1;

  let score = 50;
  const details: string[] = [];

  if (homeAway === "home") {
    // Strong home boost / penalty vs player's own away baseline
    if (homeLogs.length >= 3) {
      score += clamp(Math.round(split * 3), -18, 18);
      details.push(
        `Playing HOME — home avg ${round(homeAvg)} vs away avg ${round(awayAvg)} (Δ ${round(split)})`,
      );
      if (split >= 2) {
        score += 6;
        details.push("Clear home bump in this player's recent sample");
      } else if (split <= -2) {
        score -= 6;
        details.push("Actually softer at home lately — don't assume home = over");
      }
    } else {
      details.push("Home game, but thin home sample in the logs");
      score += 3; // small generic home bump
    }
  } else if (homeAway === "away") {
    if (awayLogs.length >= 3) {
      score += clamp(Math.round(-split * 3), -18, 18);
      details.push(
        `Playing AWAY — away avg ${round(awayAvg)} vs home avg ${round(homeAvg)} (Δ ${round(-split)} on the road)`,
      );
      if (split >= 2) {
        score -= 8;
        details.push("Road fade risk — much better at home than away");
      } else if (split <= -2) {
        score += 5;
        details.push("Travels well — away numbers hold up");
      }
    } else {
      details.push("Away game, but thin away sample in the logs");
      score -= 4; // small generic road haircut
    }
  } else {
    details.push(
      `Home/away unknown for tip-off — split home ${round(homeAvg)} / away ${round(awayAvg)}`,
    );
    if (Math.abs(split) >= 3) {
      details.push(
        `Big home/away gap (${round(Math.abs(split))}) — set H/A on the prop if you can`,
      );
    }
  }

  if (backToBack) {
    score -= 14;
    details.push("Back-to-back / short rest — usually suppresses counting stats");
  } else if (restDays !== null && restDays >= 3) {
    score += 5;
    details.push(`${restDays}d rest into last logged game`);
  }

  const trend =
    recent.length >= 3
      ? recent[0]!.value - recent[recent.length - 1]!.value
      : 0;
  if (trend > 0) {
    score += 3;
    details.push("Recent output trending up");
  } else if (trend < 0) {
    score -= 3;
    details.push("Recent output trending down");
  }

  let lean: "over" | "under" | "neutral" = "neutral";
  if (homeAway === "home" && split > 1.5) lean = "over";
  else if (homeAway === "home" && split < -1.5) lean = "under";
  else if (homeAway === "away" && split > 1.5) lean = "under";
  else if (homeAway === "away" && split < -1.5) lean = "over";

  return {
    score: clamp(Math.round(score)),
    lean,
    why: details[0] ?? "Limited schedule context",
    details,
    backToBack,
    homeAvg,
    awayAvg,
    homeAway,
  };
}