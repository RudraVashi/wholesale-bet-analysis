import { withCache } from "@/lib/cache/fs-cache";
import type { MatchMarket } from "@/lib/types";

const LEAGUE_PATHS: Record<string, { path: string; league: string }> = {
  EPL: { path: "eng.1", league: "EPL" },
  "La Liga": { path: "esp.1", league: "La Liga" },
  UCL: { path: "uefa.champions", league: "UCL" },
};

type EspnEvent = {
  id?: string;
  date?: string;
  name?: string;
  competitions?: Array<{
    competitors?: Array<{
      homeAway?: string;
      team?: { displayName?: string; abbreviation?: string };
    }>;
  }>;
};

async function fetchLeagueScoreboard(
  leagueName: string,
): Promise<MatchMarket[]> {
  const meta = LEAGUE_PATHS[leagueName];
  if (!meta) return [];

  const { data } = await withCache(
    `espn:soccer:${meta.path}:scoreboard`,
    600,
    async () => {
      const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${meta.path}/scoreboard`;
      const res = await fetch(url, {
        signal: AbortSignal.timeout(12000),
        cache: "no-store",
      });
      if (!res.ok) return [] as MatchMarket[];
      const json = (await res.json()) as { events?: EspnEvent[] };
      const markets: MatchMarket[] = [];
      for (const ev of json.events ?? []) {
        const comps = ev.competitions?.[0]?.competitors ?? [];
        const home = comps.find((c) => c.homeAway === "home");
        const away = comps.find((c) => c.homeAway === "away");
        const homeTeam = home?.team?.displayName;
        const awayTeam = away?.team?.displayName;
        if (!homeTeam || !awayTeam) continue;
        markets.push({
          id: `espn-soccer-${meta.path}-${ev.id ?? `${homeTeam}-${awayTeam}`}`,
          platform: "sportsbook",
          sport: "soccer",
          league: meta.league,
          homeTeam,
          awayTeam,
          startTime: ev.date,
          // No book line on free ESPN board — even market placeholder
          homePrice: 0,
          awayPrice: 0,
          impliedHome: 1 / 3,
          impliedAway: 1 / 3,
          impliedDraw: 1 / 3,
        });
      }
      return markets;
    },
  );
  return data;
}

/** Upcoming EPL / La Liga / UCL fixtures from ESPN (no odds — form/dossier still useful). */
export async function fetchSoccerFixtures(
  leagues: string[] = ["EPL", "La Liga"],
): Promise<{ markets: MatchMarket[]; detail: string }> {
  const batches = await Promise.all(leagues.map((l) => fetchLeagueScoreboard(l)));
  const markets = batches.flat();
  return {
    markets,
    detail:
      markets.length > 0
        ? `${markets.length} soccer fixtures (ESPN)`
        : "No soccer fixtures from ESPN right now",
  };
}