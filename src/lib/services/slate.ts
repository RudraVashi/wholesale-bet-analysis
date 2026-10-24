import { fetchSoccerPlayerLogs, fetchSoccerTeamForm } from "@/lib/adapters/api-football";
import { fetchNbaPlayerLogs } from "@/lib/adapters/espn-nba";
import { fetchSoccerFixtures } from "@/lib/adapters/espn-soccer";
import { fetchNbaMoneylines } from "@/lib/adapters/odds-api";
import { fetchPolymarketWinners } from "@/lib/adapters/polymarket";
import { fetchPrizePicksBoard } from "@/lib/adapters/prizepicks";
import {
  buildMatchScorecard,
  buildPropScorecard,
  slateEdgeFromScorecard,
} from "@/lib/analysis/scorecard";
import { gameGroupKey } from "@/lib/format";
import type {
  LeagueFilter,
  PropLine,
  SlateItem,
  SourceStatus,
} from "@/lib/types";

export async function getSourceStatus(): Promise<SourceStatus[]> {
  // Keep this light — Settings should not wait on a full slate pull.
  let ppDetail = "Not probed";
  let ppOk = false;
  try {
    const pp = await Promise.race([
      fetchPrizePicksBoard(["nba"]),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("PrizePicks probe timeout")), 4000),
      ),
    ]);
    ppOk = pp.ok;
    ppDetail = pp.blocked
      ? "Blocked from this IP — use manual paste"
      : pp.detail;
  } catch (err) {
    ppDetail = err instanceof Error ? err.message : "PrizePicks probe failed";
  }

  return [
    {
      key: "prizepicks",
      label: "PrizePicks",
      ok: ppOk,
      required: false,
      detail: ppDetail,
    },
    {
      key: "polymarket",
      label: "Polymarket",
      ok: true,
      required: false,
      detail: "Public Gamma API (probed on slate load)",
    },
    {
      key: "api_football",
      label: "API-Football",
      ok: Boolean(process.env.API_FOOTBALL_KEY),
      required: false,
      detail: process.env.API_FOOTBALL_KEY
        ? "Key present (100 req/day free)"
        : "Missing API_FOOTBALL_KEY",
    },
    {
      key: "gemini",
      label: "Gemini off-pitch",
      ok: Boolean(process.env.GEMINI_API_KEY),
      required: false,
      detail: process.env.GEMINI_API_KEY
        ? "Key present"
        : "Missing GEMINI_API_KEY",
    },
    {
      key: "odds",
      label: "The Odds API",
      ok: Boolean(process.env.ODDS_API_KEY),
      required: false,
      detail: process.env.ODDS_API_KEY
        ? "Key present (NBA ML free tier)"
        : "Optional",
    },
    {
      key: "espn",
      label: "ESPN NBA",
      ok: true,
      required: false,
      detail: "Unofficial public JSON",
    },
  ];
}

function filterLeague(filter: LeagueFilter, league: string, platform: string) {
  if (filter === "all") return true;
  if (filter === "polymarket") return platform === "polymarket";
  if (filter === "nba") return league.toUpperCase() === "NBA";
  if (filter === "epl") return /epl|premier/i.test(league);
  if (filter === "la_liga") return /la liga|laliga/i.test(league);
  if (filter === "ucl") return /ucl|champions/i.test(league);
  if (filter === "uel") return /uel|europa/i.test(league);
  return true;
}

async function quickPropItem(prop: PropLine): Promise<SlateItem> {
  const warnings: string[] = [];
  let logs = { logs: [] as Awaited<ReturnType<typeof fetchNbaPlayerLogs>>["logs"], warnings: [] as string[] };

  if (prop.sport === "nba") {
    logs = await fetchNbaPlayerLogs(prop.playerName, prop.statType, 20);
  } else {
    logs = await fetchSoccerPlayerLogs(
      prop.playerName,
      prop.league,
      prop.statType,
      20,
    );
  }
  warnings.push(...logs.warnings);

  const sc = buildPropScorecard({
    prop,
    logs: logs.logs,
    warnings,
  });

  const item: Omit<SlateItem, "gameKey"> & { gameKey?: string } = {
    id: prop.id,
    kind: "prop",
    sport: prop.sport,
    league: prop.league,
    platform: prop.platform,
    title: `${prop.playerName} · ${prop.statLabel}`,
    subtitle: `${prop.league} · line ${prop.line}${prop.homeAway ? ` · ${prop.homeAway}` : ""}`,
    line: prop.line,
    edge: slateEdgeFromScorecard(sc),
    composite: sc.composite,
    confidence: sc.confidence,
    stinker: sc.stinker,
    recommendedSide: sc.recommendedSide,
    startTime: prop.startTime,
    homeAway: prop.homeAway,
    prop,
    dataWarnings: warnings,
  };
  item.gameKey = gameGroupKey(item);
  return item;
}

export async function buildSlate(options: {
  filter?: LeagueFilter;
  manualProps?: PropLine[];
  analyzeLimit?: number;
}): Promise<{ items: SlateItem[]; statuses: SourceStatus[]; detail: string }> {
  const filter = options.filter ?? "all";
  const analyzeLimit = options.analyzeLimit ?? 12;
  const statuses = await getSourceStatus();

  const wantSoccer =
    filter === "all" ||
    filter === "epl" ||
    filter === "la_liga" ||
    filter === "ucl" ||
    filter === "uel";

  const pp = await fetchPrizePicksBoard(["nba", "epl", "la_liga"]);
  const poly = await fetchPolymarketWinners();
  const odds = await fetchNbaMoneylines();
  const soccerFx = wantSoccer
    ? await fetchSoccerFixtures(
        filter === "la_liga"
          ? ["La Liga"]
          : filter === "epl"
            ? ["EPL"]
            : filter === "ucl"
              ? ["UCL"]
              : ["EPL", "La Liga"],
      )
    : { markets: [], detail: "Soccer fixtures skipped" };

  let props = [...(options.manualProps ?? []), ...pp.props];
  props = props.filter((p) => filterLeague(filter, p.league, p.platform));

  // Cap analysis to protect free quotas / ESPN rate
  const toAnalyze = props.slice(0, analyzeLimit);
  const deferred = props.slice(analyzeLimit);

  const analyzed = await Promise.all(toAnalyze.map((p) => quickPropItem(p)));

  async function analyzeMatch(
    m: (typeof poly.markets)[number],
  ): Promise<SlateItem> {
    const warnings: string[] = [];
    let homeForm = {
      logs: [] as Awaited<ReturnType<typeof fetchSoccerTeamForm>>["logs"],
      warnings: [] as string[],
    };
    let awayForm = {
      logs: [] as typeof homeForm.logs,
      warnings: [] as string[],
    };
    if (m.sport === "soccer" && process.env.API_FOOTBALL_KEY) {
      homeForm = await fetchSoccerTeamForm(m.homeTeam, m.league);
      awayForm = await fetchSoccerTeamForm(m.awayTeam, m.league);
      warnings.push(...homeForm.warnings, ...awayForm.warnings);
    }
    const sc = buildMatchScorecard({
      match: m,
      homeForm: homeForm.logs,
      awayForm: awayForm.logs,
      warnings,
    });
    const item: SlateItem = {
      id: m.id,
      kind: "match",
      sport: m.sport,
      league: m.league,
      platform: m.platform === "polymarket" ? "polymarket" : "sportsbook",
      title: `${m.awayTeam} @ ${m.homeTeam}`,
      subtitle: `${m.league} · ${m.platform === "sportsbook" && m.homePrice === 0 ? "ESPN fixture" : m.platform}`,
      edge: slateEdgeFromScorecard(sc),
      composite: sc.composite,
      confidence: sc.confidence,
      stinker: sc.stinker,
      recommendedSide: sc.recommendedSide,
      startTime: m.startTime,
      match: m,
      dataWarnings: warnings,
    };
    item.gameKey = gameGroupKey(item);
    return item;
  }

  const polyFiltered = poly.markets
    .filter((m) => filterLeague(filter, m.league, m.platform))
    .slice(0, 6);
  const oddsFiltered = odds.markets
    .filter((m) => filterLeague(filter, m.league, m.platform))
    .slice(0, 8);
  const soccerFiltered = soccerFx.markets
    .filter((m) => filterLeague(filter, m.league, m.platform))
    .slice(0, 12);

  const matches = await Promise.all(
    [...soccerFiltered, ...polyFiltered, ...oddsFiltered].map((m) =>
      analyzeMatch(m),
    ),
  );

  const lightDeferred: SlateItem[] = deferred.map((p) => {
    const item: SlateItem = {
      id: p.id,
      kind: "prop",
      sport: p.sport,
      league: p.league,
      platform: p.platform,
      title: `${p.playerName} · ${p.statLabel}`,
      subtitle: `${p.league} · line ${p.line} · not yet analyzed`,
      line: p.line,
      startTime: p.startTime,
      homeAway: p.homeAway,
      prop: p,
      dataWarnings: ["Open dossier to run wholesale analysis"],
    };
    item.gameKey = gameGroupKey(item);
    return item;
  });

  const analyzedWithKeys = analyzed.map((item) => ({
    ...item,
    gameKey: gameGroupKey(item),
    homeAway: item.prop?.homeAway,
  }));

  const items = [...analyzedWithKeys, ...matches, ...lightDeferred].sort(
    (a, b) => (b.edge ?? -999) - (a.edge ?? -999),
  );

  const detail = [
    pp.blocked ? "PrizePicks blocked — paste lines" : pp.detail,
    poly.detail,
    odds.detail,
    soccerFx.detail,
  ].join(" · ");

  return { items, statuses, detail };
}