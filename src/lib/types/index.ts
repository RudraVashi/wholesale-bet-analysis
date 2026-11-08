export type Sport = "nba" | "soccer";
export type Platform = "prizepicks" | "polymarket" | "manual" | "sportsbook";
export type Side = "over" | "under" | "home" | "away" | "draw";
export type LeagueFilter =
  | "all"
  | "nba"
  | "epl"
  | "la_liga"
  | "ucl"
  | "uel"
  | "polymarket";

export type StatType =
  | "points"
  | "rebounds"
  | "assists"
  | "pra"
  | "pts_asts"
  | "pts_rebs"
  | "rebs_asts"
  | "fantasy_score"
  | "threes"
  | "fg_made"
  | "steals"
  | "blocks"
  | "turnovers"
  | "shots_on_target"
  | "shots"
  | "passes_attempted"
  | "tackles"
  | "goals"
  | "assists_soccer"
  | "moneyline"
  | "other";

export interface PropLine {
  id: string;
  platform: Platform;
  sport: Sport;
  league: string;
  playerName: string;
  team: string;
  opponent?: string;
  gameId?: string;
  startTime?: string;
  statType: StatType;
  statLabel: string;
  line: number;
  side?: Side;
  homeAway?: "home" | "away";
  source: "prizepicks" | "manual" | "polymarket" | "odds";
}

export interface MatchMarket {
  id: string;
  platform: "polymarket" | "sportsbook";
  sport: Sport;
  league: string;
  homeTeam: string;
  awayTeam: string;
  startTime?: string;
  homePrice: number;
  awayPrice: number;
  drawPrice?: number;
  impliedHome: number;
  impliedAway: number;
  impliedDraw?: number;
  marketSlug?: string;
  conditionId?: string;
}

export interface GameLog {
  date: string;
  opponent: string;
  home: boolean;
  minutes?: number;
  value: number;
  teamScore?: number;
  oppScore?: number;
}

export interface FactorScore {
  key:
    | "form"
    | "dynamics"
    | "performance"
    | "offpitch"
    | "lineValue"
    | "contrarian";
  label: string;
  score: number;
  lean: "over" | "under" | "home" | "away" | "neutral";
  why: string;
  details?: string[];
}

export interface FormWindow {
  window: 10 | 20;
  sample: number;
  hitRate: number;
  avg: number;
  median: number;
  hits: number;
  logs: GameLog[];
}

export interface LastFiveGame {
  date: string;
  opponent: string;
  value: number;
  hit: boolean;
}

/** PrizePicks-style strip. Games are newest-first; tonight is not included. */
export interface LastFive {
  side: "over" | "under";
  sample: number;
  hits: number;
  games: LastFiveGame[];
}

export interface NextGameBucket {
  /** How many of the five games before the outcome game cleared the line. */
  priorHits: number;
  nextGames: number;
  nextHits: number;
  /** Fewer than 3 next games — do not treat the rate as a lean. */
  thin: boolean;
}

/** Consecutive hits ending at the newest game; next-game continuation study. */
export interface ConsecutiveStreakStudy {
  side: "over" | "under";
  currentStreak: number;
  nextGames: number;
  /** Times the next game also hit (streak continued). */
  nextHits: number;
  thin: boolean;
  summary: string;
}

export interface LastFiveCountStudy {
  currentPriorHits: number | null;
  buckets: NextGameBucket[];
  matching?: NextGameBucket;
  summary: string;
}

export interface NextGameAfterStreak {
  /** Primary: consecutive overs/unders into tonight. */
  consecutive: ConsecutiveStreakStudy;
  /** Secondary: L5 hit-count setup (not necessarily consecutive). */
  lastFiveCount: LastFiveCountStudy;
  /** Combined plain-English lines for fan take / form details. */
  summary: string;
}

export interface FanTake {
  headline: string;
  bullets: string[];
  bottomLine: string;
}

export interface Scorecard {
  id: string;
  kind: "prop" | "match";
  title: string;
  subtitle: string;
  sport: Sport;
  league: string;
  platform: Platform;
  line?: number;
  side?: Side;
  recommendedSide: Side | "pass";
  composite: number;
  confidence: number;
  stinker: boolean;
  stinkerReason?: string;
  factors: FactorScore[];
  formL10?: FormWindow;
  formL20?: FormWindow;
  lastFive?: LastFive;
  nextGame?: NextGameAfterStreak;
  offPitch?: OffPitchDigest;
  fanTake?: FanTake;
  prop?: PropLine;
  match?: MatchMarket;
  startTime?: string;
  generatedAt: string;
  dataWarnings: string[];
}

export interface OffPitchDigest {
  score: number;
  lean: "over" | "under" | "home" | "away" | "neutral";
  summary: string;
  bullets: string[];
  severity: "low" | "medium" | "high";
  sources?: string[];
}

export interface SlateItem {
  id: string;
  kind: "prop" | "match";
  sport: Sport;
  league: string;
  platform: Platform;
  title: string;
  subtitle: string;
  line?: number;
  edge?: number;
  composite?: number;
  confidence?: number;
  stinker?: boolean;
  recommendedSide?: Side | "pass";
  startTime?: string;
  gameKey?: string;
  homeAway?: "home" | "away";
  /** Hits in the newest games we have, up to 5. Absent when the prop was not analyzed. */
  l5Hits?: number;
  l5Sample?: number;
  prop?: PropLine;
  match?: MatchMarket;
  dataWarnings?: string[];
}

export interface PowerLeg {
  id: string;
  scorecardId: string;
  title: string;
  subtitle: string;
  side: Side;
  line?: number;
  sport: Sport;
  team?: string;
  gameId?: string;
  composite: number;
  confidence: number;
  stinker: boolean;
}

export interface JournalEntry {
  id: string;
  createdAt: string;
  platform: Platform;
  sport: Sport;
  legs: PowerLeg[];
  stake?: number;
  result: "pending" | "win" | "loss" | "push";
  notes?: string;
}

export interface SourceStatus {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
  required: boolean;
}