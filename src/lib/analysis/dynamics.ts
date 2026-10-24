import type { GameLog } from "@/lib/types";
import { clamp, round } from "@/lib/utils";

function daysBetween(a: string, b: string) {
  const da = Date.parse(a);
  const db = Date.parse(b);
  if (Number.isNaN(da) || Number.isNaN(db)) return null;
  return Math.round(Math.abs(db - da) / 86400000);
}

export function dynamicsFactor(logs: GameLog[], homeAway?: "home" | "away") {
  const recent = logs.slice(0, 5);
  const homeLogs = logs.filter((l) => l.home).slice(0, 10);
  const awayLogs = logs.filter((l) => !l.home).slice(0, 10);
  const homeAvg =
    homeLogs.reduce((s, l) => s + l.value, 0) / Math.max(homeLogs.length, 1);
  const awayAvg =
    awayLogs.reduce((s, l) => s + l.value, 0) / Math.max(awayLogs.length, 1);

  let restDays: number | null = null;
  if (logs.length >= 2) {
    restDays = daysBetween(logs[0]!.date, logs[1]!.date);
  }
  const backToBack = restDays !== null && restDays <= 1;

  let score = 55;
  const details: string[] = [];

  if (homeAway === "home") {
    score += homeAvg >= awayAvg ? 8 : -4;
    details.push(`Home avg ${round(homeAvg)} vs away avg ${round(awayAvg)}`);
  } else if (homeAway === "away") {
    score += awayAvg >= homeAvg ? 6 : -6;
    details.push(`Away avg ${round(awayAvg)} vs home avg ${round(homeAvg)}`);
  } else {
    details.push(`Split home ${round(homeAvg)} / away ${round(awayAvg)}`);
  }

  if (backToBack) {
    score -= 12;
    details.push("Back-to-back / short rest in recent schedule");
  } else if (restDays !== null && restDays >= 3) {
    score += 5;
    details.push(`${restDays}d rest into last game`);
  }

  const trend =
    recent.length >= 3
      ? recent[0]!.value - recent[recent.length - 1]!.value
      : 0;
  if (trend > 0) {
    score += 4;
    details.push("Recent output trending up");
  } else if (trend < 0) {
    score -= 4;
    details.push("Recent output trending down");
  }

  const lean =
    homeAway === "home" && homeAvg > awayAvg + 1
      ? ("over" as const)
      : homeAway === "away" && awayAvg < homeAvg - 1
        ? ("under" as const)
        : ("neutral" as const);

  return {
    score: clamp(Math.round(score)),
    lean,
    why: details[0] ?? "Limited schedule context",
    details,
    backToBack,
  };
}