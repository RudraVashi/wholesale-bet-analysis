import { withCache } from "@/lib/cache/fs-cache";
import type { GameLog, StatType } from "@/lib/types";

const BASE = "https://v3.football.api-sports.io";

export const FOOTBALL_LEAGUES: Record<string, number> = {
  EPL: 39,
  "La Liga": 140,
  UCL: 2,
  UEL: 3,
  Bundesliga: 78,
  "Serie A": 135,
  "Ligue 1": 61,
};

function seasonYear() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  // European season starts ~Aug
  const current = m >= 7 ? y : y - 1;
  // Free API-Football plans only expose a limited season window (currently thru 2024).
  return Math.min(current, 2024);
}

function headers() {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) return null;
  return {
    "x-apisports-key": key,
  };
}

export function apiFootballConfigured() {
  return Boolean(process.env.API_FOOTBALL_KEY);
}

async function afFetch<T>(
  path: string,
  params: Record<string, string | number>,
  ttl: number,
  cacheKey: string,
): Promise<{ data: T | null; warning?: string; quota?: boolean }> {
  const h = headers();
  if (!h) {
    return {
      data: null,
      warning: "API_FOOTBALL_KEY missing — soccer form unavailable",
    };
  }

  try {
    const { data } = await withCache(cacheKey, ttl, async () => {
      const url = new URL(BASE + path);
      for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, String(v));
      }
      const res = await fetch(url.toString(), {
        headers: h,
        signal: AbortSignal.timeout(12000),
        cache: "no-store",
      });
      if (res.status === 429) {
        throw Object.assign(new Error("API-Football quota hit"), {
          quota: true,
        });
      }
      if (!res.ok) {
        throw new Error(`API-Football HTTP ${res.status}`);
      }
      const json = (await res.json()) as {
        response?: T;
        errors?: unknown;
      };
      return json.response ?? null;
    });
    return { data: data as T | null };
  } catch (err) {
    const quota = Boolean((err as { quota?: boolean })?.quota);
    return {
      data: null,
      quota,
      warning: err instanceof Error ? err.message : "API-Football error",
    };
  }
}

function soccerValue(
  stats: Record<string, unknown> | undefined,
  statType: StatType,
): number | null {
  if (!stats) return null;
  const shots = (stats.shots as Record<string, number> | undefined) ?? {};
  const passes = (stats.passes as Record<string, number> | undefined) ?? {};
  const goals = (stats.goals as Record<string, number> | undefined) ?? {};
  const tackles = (stats.tackles as Record<string, number> | undefined) ?? {};
  switch (statType) {
    case "shots_on_target":
      return Number(shots.on ?? 0);
    case "shots":
      return Number(shots.total ?? 0);
    case "passes_attempted":
      return Number(passes.total ?? 0);
    case "goals":
      return Number(goals.total ?? 0);
    case "assists":
    case "assists_soccer":
      return Number(goals.assists ?? 0);
    case "tackles":
      return Number(tackles.total ?? 0);
    default:
      return null;
  }
}

export async function searchSoccerPlayer(
  name: string,
  leagueName = "EPL",
): Promise<{ id: number; name: string; team?: string } | null> {
  const leagueId = FOOTBALL_LEAGUES[leagueName] ?? 39;
  const { data, warning } = await afFetch<
    Array<{ player: { id: number; name: string }; statistics?: Array<{ team?: { name?: string } }> }>
  >(
    "/players",
    { search: name, league: leagueId, season: seasonYear() },
    86400,
    `af:player:${leagueId}:${name.toLowerCase()}`,
  );
  if (!data?.[0]) {
    if (warning) return null;
    return null;
  }
  const hit = data[0];
  return {
    id: hit.player.id,
    name: hit.player.name,
    team: hit.statistics?.[0]?.team?.name,
  };
}

export async function fetchSoccerPlayerLogs(
  playerName: string,
  leagueName: string,
  statType: StatType,
  limit = 20,
): Promise<{ logs: GameLog[]; warnings: string[] }> {
  const warnings: string[] = [];
  if (!apiFootballConfigured()) {
    return {
      logs: [],
      warnings: [
        "Set API_FOOTBALL_KEY (free at api-football.com) for soccer L10/L20 form.",
      ],
    };
  }

  const player = await searchSoccerPlayer(playerName, leagueName);
  if (!player) {
    return {
      logs: [],
      warnings: [`Could not resolve soccer player "${playerName}".`],
    };
  }

  const leagueId = FOOTBALL_LEAGUES[leagueName] ?? 39;
  const { data, warning, quota } = await afFetch<
    Array<{
      fixture?: {
        date?: string;
        id?: number;
      };
      teams?: {
        home?: { name?: string };
        away?: { name?: string };
      };
      statistics?: Array<Record<string, unknown>>;
    }>
  >(
    "/players",
    {
      id: player.id,
      season: seasonYear(),
      league: leagueId,
    },
    3600,
    `af:logs:${player.id}:${leagueId}:${seasonYear()}`,
  );

  if (quota) warnings.push("API-Football quota hit — retry later.");
  if (warning) warnings.push(warning);
  if (!data) return { logs: [], warnings };

  // /players?id= returns season aggregates in statistics, not per-fixture.
  // Use fixtures + players/profiles via player fixture stats endpoint.
  const fixtures = await afFetch<
    Array<{
      fixture: { id: number; date: string };
      teams: {
        home: { id: number; name: string };
        away: { id: number; name: string };
      };
    }>
  >(
    "/fixtures",
    {
      league: leagueId,
      season: seasonYear(),
      last: Math.min(limit + 5, 30),
      team: 0,
    },
    1800,
    `af:fixtures-skip`,
  );
  void fixtures;

  // Better path: players/profiles with fixture id — fetch recent fixtures for player's team via sideline
  const teamFixtures = await afFetch<
    Array<{
      fixture: { id: number; date: string };
      teams: {
        home: { id: number; name: string };
        away: { id: number; name: string };
      };
    }>
  >(
    "/fixtures",
    {
      player: player.id,
      season: seasonYear(),
      last: limit,
    },
    1800,
    `af:fixtures:player:${player.id}:${seasonYear()}`,
  );

  if (teamFixtures.quota) warnings.push("API-Football quota hit on fixtures.");
  if (teamFixtures.warning) warnings.push(teamFixtures.warning);

  const logs: GameLog[] = [];
  for (const fx of teamFixtures.data ?? []) {
    const { data: pstats, warning: w2 } = await afFetch<
      Array<{
        players?: Array<{
          player?: { id?: number };
          statistics?: Array<Record<string, unknown>>;
        }>;
      }>
    >(
      "/fixtures/players",
      { fixture: fx.fixture.id },
      86400,
      `af:fxplayers:${fx.fixture.id}`,
    );
    if (w2 && !warnings.includes(w2)) warnings.push(w2);
    let found: GameLog | null = null;
    for (const team of pstats ?? []) {
      for (const p of team.players ?? []) {
        if (p.player?.id !== player.id) continue;
        const value = soccerValue(p.statistics?.[0], statType);
        if (value === null) continue;
        const homeName = fx.teams.home.name;
        const awayName = fx.teams.away.name;
        // Unknown which team player is on; opponent = other side from player team name if known
        const opponent =
          player.team && homeName === player.team
            ? awayName
            : player.team && awayName === player.team
              ? homeName
              : awayName;
        const home = player.team ? homeName === player.team : true;
        found = {
          date: fx.fixture.date.slice(0, 10),
          opponent,
          home,
          value,
        };
      }
    }
    if (found) logs.push(found);
    if (logs.length >= limit) break;
  }

  if (logs.length === 0) {
    warnings.push(
      "No per-match soccer player stats available (quota or coverage).",
    );
  }

  return { logs, warnings };
}

export async function fetchSoccerTeamForm(
  teamName: string,
  leagueName: string,
): Promise<{ logs: GameLog[]; warnings: string[] }> {
  const warnings: string[] = [];
  if (!apiFootballConfigured()) {
    return {
      logs: [],
      warnings: ["API_FOOTBALL_KEY missing for team form."],
    };
  }
  const leagueId = FOOTBALL_LEAGUES[leagueName] ?? 39;
  const teams = await afFetch<
    Array<{ team: { id: number; name: string } }>
  >(
    "/teams",
    { search: teamName, league: leagueId, season: seasonYear() },
    86400,
    `af:team:${leagueId}:${teamName.toLowerCase()}`,
  );
  const team = teams.data?.[0]?.team;
  if (!team) {
    return { logs: [], warnings: [`Team not found: ${teamName}`] };
  }
  const fixtures = await afFetch<
    Array<{
      fixture: { date: string };
      teams: {
        home: { id: number; name: string };
        away: { id: number; name: string };
      };
      goals: { home: number | null; away: number | null };
    }>
  >(
    "/fixtures",
    { team: team.id, last: 20, season: seasonYear() },
    1800,
    `af:teamform:${team.id}`,
  );
  if (fixtures.warning) warnings.push(fixtures.warning);
  const logs: GameLog[] = (fixtures.data ?? []).map((fx) => {
    const home = fx.teams.home.id === team.id;
    const gf = home ? fx.goals.home : fx.goals.away;
    const ga = home ? fx.goals.away : fx.goals.home;
    const value = (gf ?? 0) - (ga ?? 0);
    return {
      date: fx.fixture.date.slice(0, 10),
      opponent: home ? fx.teams.away.name : fx.teams.home.name,
      home,
      value,
      teamScore: gf ?? undefined,
      oppScore: ga ?? undefined,
    };
  });
  return { logs, warnings };
}