import type { StatType } from "@/lib/types";

const LABEL_MAP: Record<string, StatType> = {
  points: "points",
  pts: "points",
  rebounds: "rebounds",
  reb: "rebounds",
  assists: "assists",
  ast: "assists",
  "pts+rebs+asts": "pra",
  "pts+reb+ast": "pra",
  pra: "pra",
  "fantasy score": "fantasy_score",
  fantasy_score: "fantasy_score",
  "3-pt made": "threes",
  "3-ptm": "threes",
  "3ptm": "threes",
  "3pm": "threes",
  "3pt": "threes",
  "3-pt": "threes",
  "3-pointers": "threes",
  "3-pointers made": "threes",
  "3 pointers": "threes",
  "3 pointers made": "threes",
  "three pointers": "threes",
  "three pointers made": "threes",
  "three-pointers made": "threes",
  threes: "threes",
  steals: "steals",
  blocks: "blocks",
  turnovers: "turnovers",
  "shots on target": "shots_on_target",
  sot: "shots_on_target",
  shots: "shots",
  "shots attempted": "shots",
  "passes attempted": "passes_attempted",
  "pass attempts": "passes_attempted",
  tackles: "tackles",
  goals: "goals",
  goal: "goals",
};

export function normalizeStatType(raw: string): StatType {
  const key = raw.trim().toLowerCase();
  if (LABEL_MAP[key]) return LABEL_MAP[key]!;
  // PrizePicks paste often uses compact labels like "3PTM" / "PTS+REBS+ASTS"
  const compact = key.replace(/[\s_]+/g, "");
  if (LABEL_MAP[compact]) return LABEL_MAP[compact]!;
  return "other";
}

export function statLabel(stat: StatType, fallback?: string): string {
  const labels: Record<StatType, string> = {
    points: "Points",
    rebounds: "Rebounds",
    assists: "Assists",
    pra: "PRA",
    fantasy_score: "Fantasy Score",
    threes: "3PM",
    steals: "Steals",
    blocks: "Blocks",
    turnovers: "Turnovers",
    shots_on_target: "Shots on Target",
    shots: "Shots",
    passes_attempted: "Passes Attempted",
    tackles: "Tackles",
    goals: "Goals",
    assists_soccer: "Assists",
    moneyline: "Moneyline",
    other: fallback ?? "Stat",
  };
  return labels[stat];
}

/** DraftKings-style fantasy: PTS*1 + REB*1.2 + AST*1.5 + STL*3 + BLK*3 - TO*1 */
export function nbaFantasy(box: {
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
}) {
  return (
    box.pts * 1 +
    box.reb * 1.2 +
    box.ast * 1.5 +
    box.stl * 3 +
    box.blk * 3 -
    box.tov * 1
  );
}