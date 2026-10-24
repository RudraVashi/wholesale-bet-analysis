import { withCache } from "@/lib/cache/fs-cache";
import type { MatchMarket } from "@/lib/types";

export function oddsApiConfigured() {
  return Boolean(process.env.ODDS_API_KEY);
}

/** Free tier: NBA moneylines only. */
export async function fetchNbaMoneylines(): Promise<{
  markets: MatchMarket[];
  ok: boolean;
  detail: string;
}> {
  const key = process.env.ODDS_API_KEY;
  if (!key) {
    return {
      markets: [],
      ok: false,
      detail: "ODDS_API_KEY not set (optional; free tier = NBA ML only)",
    };
  }

  try {
    const { data } = await withCache("odds:nba:h2h", 300, async () => {
      const url = new URL(
        "https://api.the-odds-api.com/v4/sports/basketball_nba/odds",
      );
      url.searchParams.set("apiKey", key);
      url.searchParams.set("regions", "us");
      url.searchParams.set("markets", "h2h");
      url.searchParams.set("oddsFormat", "american");
      const res = await fetch(url.toString(), {
        signal: AbortSignal.timeout(12000),
        cache: "no-store",
      });
      if (res.status === 429) {
        throw Object.assign(new Error("Odds API quota hit"), { quota: true });
      }
      if (!res.ok) throw new Error(`Odds API HTTP ${res.status}`);
      return (await res.json()) as Array<{
        id: string;
        commence_time: string;
        home_team: string;
        away_team: string;
        bookmakers?: Array<{
          markets?: Array<{
            key: string;
            outcomes?: Array<{ name: string; price: number }>;
          }>;
        }>;
      }>;
    });

    const markets: MatchMarket[] = [];
    for (const g of data) {
      const outcomes =
        g.bookmakers?.[0]?.markets?.find((m) => m.key === "h2h")?.outcomes ??
        [];
      const home = outcomes.find((o) => o.name === g.home_team);
      const away = outcomes.find((o) => o.name === g.away_team);
      if (!home || !away) continue;
      const impliedHome = americanToImplied(home.price);
      const impliedAway = americanToImplied(away.price);
      markets.push({
        id: `odds-${g.id}`,
        platform: "sportsbook",
        sport: "nba",
        league: "NBA",
        homeTeam: g.home_team,
        awayTeam: g.away_team,
        startTime: g.commence_time,
        homePrice: home.price,
        awayPrice: away.price,
        impliedHome,
        impliedAway,
      });
    }
    return {
      markets,
      ok: true,
      detail: `${markets.length} NBA moneylines`,
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