import { withCache } from "@/lib/cache/fs-cache";
import type { MatchMarket, Sport } from "@/lib/types";

type GammaMarket = {
  id?: string;
  question?: string;
  conditionId?: string;
  slug?: string;
  outcomes?: string;
  outcomePrices?: string;
  sportsMarketType?: string;
  closed?: boolean;
  active?: boolean;
  endDate?: string;
  gameStartTime?: string;
  events?: Array<{
    title?: string;
    slug?: string;
    startDate?: string;
    closed?: boolean;
  }>;
};

type ScoreboardEvent = {
  name?: string;
  date?: string;
  competitions?: Array<{
    competitors?: Array<{
      homeAway?: string;
      team?: { displayName?: string; shortDisplayName?: string; abbreviation?: string };
    }>;
  }>;
};

function parseJsonArray(raw?: string): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

function parsePrices(raw?: string): number[] {
  return parseJsonArray(raw)
    .map((x) => Number(x))
    .filter((n) => !Number.isNaN(n));
}

function isJunkOutcomes(outcomes: string[]) {
  const lower = outcomes.map((o) => o.toLowerCase().trim());
  if (lower.includes("yes") && lower.includes("no")) return true;
  if (lower.includes("over") && lower.includes("under")) return true;
  if (lower.includes("odd") && lower.includes("even")) return true;
  if (outcomes.some((o) => o.includes("/"))) return true;
  if (outcomes.some((o) => /[+-]\d/.test(o))) return true;
  return false;
}

function splitTeams(title: string): { home: string; away: string } | null {
  const cleaned = title
    .replace(/^.*?:\s*/i, "")
    .replace(/\s*\(.*?\)\s*/g, " ")
    .trim();
  const vs = cleaned.split(/\s+vs\.?\s+/i);
  if (vs.length === 2) return { away: vs[0]!.trim(), home: vs[1]!.trim() };
  const at = cleaned.split(/\s+@\s+/);
  if (at.length === 2) return { away: at[0]!.trim(), home: at[1]!.trim() };
  return null;
}

function toMarket(
  market: GammaMarket,
  sport: Sport,
  league: string,
): MatchMarket | null {
  if (market.closed) return null;
  const title =
    market.events?.[0]?.title ?? market.question ?? market.slug ?? "";
  const outcomes = parseJsonArray(market.outcomes);
  const prices = parsePrices(market.outcomePrices);
  if (outcomes.length < 2 || prices.length < 2) return null;
  if (isJunkOutcomes(outcomes)) return null;

  const type = (market.sportsMarketType ?? "").toLowerCase();
  // Prefer moneyline; also allow untitled team-vs-team
  if (
    type &&
    type !== "moneyline" &&
    !type.includes("money") &&
    type !== "ml"
  ) {
    return null;
  }

  const teams =
    splitTeams(title) ||
    (outcomes.length >= 2
      ? { away: outcomes[0]!, home: outcomes[1]! }
      : null);
  if (!teams) return null;

  let homeTeam = teams.home;
  let awayTeam = teams.away;
  let homePrice = prices[1] ?? prices[0]!;
  let awayPrice = prices[0]!;

  const lowerOut = outcomes.map((o) => o.toLowerCase());
  const homeIdx = lowerOut.findIndex(
    (o) =>
      o.includes(homeTeam.toLowerCase().slice(0, 5)) ||
      homeTeam.toLowerCase().includes(o.slice(0, 5)),
  );
  const awayIdx = lowerOut.findIndex(
    (o) =>
      o.includes(awayTeam.toLowerCase().slice(0, 5)) ||
      awayTeam.toLowerCase().includes(o.slice(0, 5)),
  );
  if (homeIdx >= 0 && awayIdx >= 0 && homeIdx !== awayIdx) {
    homePrice = prices[homeIdx] ?? homePrice;
    awayPrice = prices[awayIdx] ?? awayPrice;
    homeTeam = outcomes[homeIdx] ?? homeTeam;
    awayTeam = outcomes[awayIdx] ?? awayTeam;
  } else {
    awayTeam = outcomes[0]!;
    homeTeam = outcomes[1]!;
    awayPrice = prices[0]!;
    homePrice = prices[1]!;
  }

  return {
    id: `poly-${market.conditionId ?? market.id}`,
    platform: "polymarket",
    sport,
    league,
    homeTeam,
    awayTeam,
    startTime:
      market.gameStartTime ??
      market.events?.[0]?.startDate ??
      market.endDate,
    homePrice,
    awayPrice,
    impliedHome: homePrice,
    impliedAway: awayPrice,
    marketSlug: market.slug,
    conditionId: market.conditionId,
  };
}

async function searchPolymarket(q: string): Promise<GammaMarket[]> {
  const url = new URL("https://gamma-api.polymarket.com/public-search");
  url.searchParams.set("q", q);
  url.searchParams.set("limit_per_type", "20");
  const res = await fetch(url.toString(), {
    signal: AbortSignal.timeout(12000),
    cache: "no-store",
  });
  if (!res.ok) return [];
  const json = (await res.json()) as {
    events?: Array<{
      title?: string;
      slug?: string;
      startDate?: string;
      closed?: boolean;
      markets?: GammaMarket[];
    }>;
  };
  const out: GammaMarket[] = [];
  for (const event of json.events ?? []) {
    for (const m of event.markets ?? []) {
      if (m.closed || event.closed) continue;
      out.push({
        ...m,
        events: [
          {
            title: event.title,
            slug: event.slug,
            startDate: event.startDate,
            closed: event.closed,
          },
        ],
      });
    }
  }
  return out;
}

async function nbaMatchupQueries(): Promise<string[]> {
  try {
    const res = await fetch(
      "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard",
      { signal: AbortSignal.timeout(10000), cache: "no-store" },
    );
    if (!res.ok) return ["Lakers vs", "Celtics vs", "Clippers vs"];
    const json = (await res.json()) as { events?: ScoreboardEvent[] };
    const queries: string[] = [];
    for (const ev of json.events ?? []) {
      const comps = ev.competitions?.[0]?.competitors ?? [];
      const home = comps.find((c) => c.homeAway === "home");
      const away = comps.find((c) => c.homeAway === "away");
      const homeName =
        home?.team?.shortDisplayName ?? home?.team?.abbreviation;
      const awayName =
        away?.team?.shortDisplayName ?? away?.team?.abbreviation;
      if (homeName && awayName) {
        queries.push(`${awayName} vs. ${homeName}`);
        queries.push(`${awayName} vs`);
      }
    }
    return queries.length > 0
      ? queries.slice(0, 8)
      : ["Lakers vs", "Celtics vs", "Knicks vs", "Clippers vs"];
  } catch {
    return ["Lakers vs", "Celtics vs", "Clippers vs", "Knicks vs"];
  }
}

const SOCCER_QUERIES = [
  "Arsenal vs",
  "Chelsea vs",
  "Liverpool vs",
  "Barcelona vs",
  "Real Madrid vs",
];

export async function fetchPolymarketWinners(): Promise<{
  markets: MatchMarket[];
  ok: boolean;
  detail: string;
}> {
  const { data } = await withCache("polymarket:winners:v3", 180, async () => {
    const nbaQueries = await nbaMatchupQueries();
    const queries = [
      ...nbaQueries.map((q) => ({ q, sport: "nba" as const, league: "NBA" })),
      ...SOCCER_QUERIES.map((q) => ({
        q,
        sport: "soccer" as const,
        league: /Barcelona|Madrid|Atletico/i.test(q) ? "La Liga" : "EPL",
      })),
    ];

    const pages = await Promise.all(
      queries.map(async (item) => ({
        ...item,
        markets: await searchPolymarket(item.q),
      })),
    );

    const markets: MatchMarket[] = [];
    const seen = new Set<string>();
    const seenMatchup = new Set<string>();
    for (const page of pages) {
      for (const m of page.markets) {
        const mapped = toMarket(m, page.sport, page.league);
        if (!mapped) continue;
        if (seen.has(mapped.id)) continue;
        const matchupKey = [
          mapped.league,
          mapped.homeTeam.toLowerCase(),
          mapped.awayTeam.toLowerCase(),
        ].join("|");
        if (seenMatchup.has(matchupKey)) continue;
        seen.add(mapped.id);
        seenMatchup.add(matchupKey);
        markets.push(mapped);
      }
    }

    return {
      markets,
      ok: true,
      detail:
        markets.length > 0
          ? `${markets.length} Polymarket match-winner markets`
          : "No open match-winner markets found right now",
    };
  });
  return data;
}