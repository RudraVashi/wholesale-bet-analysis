import { withCache } from "@/lib/cache/fs-cache";
import type { MatchMarket } from "@/lib/types";

export function oddsApiConfigured() {
  return Boolean(process.env.ODDS_API_KEY);
}

type OddsEvent = {
  event_id: string;
  home_team: string;
  away_team: string;
  start_time?: string;
  books?: Array<{
    book?: string;
    market?: string;
    outcomes?: Array<{ name: string; price: number }>;
  }>;
};

/** Free tier: NBA moneylines only (TheOddsAPI current root namespace). */
export async function fetchNbaMoneylines(): Promise<{
  markets: MatchMarket[];
  ok: boolean;
  detail: string;
}> {
  const key = process.env.ODDS_API_KEY?.trim();
  if (!key) {
    return {
      markets: [],
      ok: false,
      detail: "ODDS_API_KEY not set (optional; free tier = NBA ML only)",
    };
  }

  try {
    const { data } = await withCache("odds:nba:h2h:v2", 300, async () => {
      const url = new URL("https://api.theoddsapi.com/odds/");
      url.searchParams.set("sport_key", "basketball_nba");
      url.searchParams.set("markets", "h2h");
      url.searchParams.set("regions", "us");
      const res = await fetch(url.toString(), {
        headers: { "x-api-key": key },
        signal: AbortSignal.timeout(12000),
        cache: "no-store",
      });
      if (res.status === 429) {
        throw Object.assign(new Error("Odds API quota hit"), { quota: true });
      }
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Odds API HTTP ${res.status}: ${body.slice(0, 120)}`);
      }
      const json = (await res.json()) as {
        success?: boolean;
        data?: OddsEvent[];
      };
      return json.data ?? [];
    });

    const markets: MatchMarket[] = [];
    for (const g of data) {
      const book =
        g.books?.find((b) => b.book === "draftkings") ??
        g.books?.find((b) => b.market === "h2h") ??
        g.books?.[0];
      const outcomes = book?.outcomes ?? [];
      const home = outcomes.find((o) => o.name === g.home_team);
      const away = outcomes.find((o) => o.name === g.away_team);
      if (!home || !away) continue;
      markets.push({
        id: `odds-${g.event_id}`,
        platform: "sportsbook",
        sport: "nba",
        league: "NBA",
        homeTeam: g.home_team,
        awayTeam: g.away_team,
        startTime: g.start_time,
        homePrice: home.price,
        awayPrice: away.price,
        impliedHome: americanToImplied(home.price),
        impliedAway: americanToImplied(away.price),
      });
    }
    return {
      markets,
      ok: true,
      detail: `${markets.length} NBA moneylines (TheOddsAPI)`,
    };
  } catch (err) {
    return {
      markets: [],
      ok: false,
      detail: err instanceof Error ? err.message : "Odds API failed",
    };
  }
}

function americanToImplied(american: number): number {
  if (american > 0) return 100 / (american + 100);
  return Math.abs(american) / (Math.abs(american) + 100);
}
