import { fetchSoccerPlayerLogs, fetchSoccerTeamForm } from "@/lib/adapters/api-football";
import { fetchNbaPlayerLogs } from "@/lib/adapters/espn-nba";
import { fetchNbaMoneylines } from "@/lib/adapters/odds-api";
import { fetchPolymarketWinners } from "@/lib/adapters/polymarket";
import { fetchPrizePicksBoard } from "@/lib/adapters/prizepicks";
import {
  buildMatchScorecard,
  buildPropScorecard,
  slateEdgeFromScorecard,
} from "@/lib/analysis/scorecard";
import type {
  LeagueFilter,
  PropLine,
  SlateItem,
  SourceStatus,
} from "@/lib/types";

export async function getSourceStatus(): Promise<SourceStatus[]> {
  const pp = await fetchPrizePicksBoard(["nba"]);
  const poly = await fetchPolymarketWinners();
  return [
    {
      key: "prizepicks",
      label: "PrizePicks",
      ok: pp.ok,
      required: false,
      detail: pp.blocked
        ? "Blocked from this IP — use manual paste"
        : pp.detail,
    },
    {
      key: "polymarket",
      label: "Polymarket",
      ok: poly.ok && poly.markets.length > 0,
      required: false,
      detail: poly.detail,
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

  return {
    id: prop.id,
    kind: "prop",
    sport: prop.sport,
    league: prop.league,
    platform: prop.platform,
    title: `${prop.playerName} · ${prop.statLabel}`,
    subtitle: `${prop.league} · line ${prop.line}`,
    line: prop.line,
    edge: slateEdgeFromScorecard(sc),
    composite: sc.composite,
    confidence: sc.confidence,
    stinker: sc.stinker,
    recommendedSide: sc.recommendedSide,
    startTime: prop.startTime,
    prop,
    dataWarnings: warnings,
  };
}

export async function buildSlate(options: {
  filter?: LeagueFilter;
  manualProps?: PropLine[];
  analyzeLimit?: number;
}): Promise<{ items: SlateItem[]; statuses: SourceStatus[]; detail: string }> {
  const filter = options.filter ?? "all";
  const analyzeLimit = options.analyzeLimit ?? 12;
  const statuses = await getSourceStatus();

  const pp = await fetchPrizePicksBoard(["nba", "epl", "la_liga"]);
  const poly = await fetchPolymarketWinners();
  const odds = await fetchNbaMoneylines();

  let props = [...(options.manualProps ?? []), ...pp.props];
  props = props.filter((p) =>
    filterLeague(filter, p.league, p.platform),
  );

  // Cap analysis to protect free quotas / ESPN rate
  const toAnalyze = props.slice(0, analyzeLimit);
  const deferred = props.slice(analyzeLimit);

  const analyzed = await Promise.all(toAnalyze.map((p) => quickPropItem(p)));

  const matchItems: Array<Promise<SlateItem>> = [];
  for (const m of [...poly.markets, ...odds.markets]) {
    if (!filterLeague(filter, m.league, m.platform)) continue;
    matchItems.push(
      (async () => {
        const warnings: string[] = [];
        let homeForm = { logs: [] as Awaited<ReturnType<typeof fetchSoccerTeamForm>>["logs"], warnings: [] as string[] };
        let awayForm = { logs: [] as typeof homeForm.logs, warnings: [] as string[] };
        if (m.sport === "soccer") {
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
        return {
          id: m.id,
          kind: "match" as const,
          sport: m.sport,
          league: m.league,
          platform: m.platform === "polymarket" ? "polymarket" as const : "sportsbook" as const,
          title: `${m.awayTeam} @ ${m.homeTeam}`,
          subtitle: `${m.league} · ${m.platform}`,
          edge: slateEdgeFromScorecard(sc),
          composite: sc.composite,
          confidence: sc.confidence,
          stinker: sc.stinker,
          recommendedSide: sc.recommendedSide,
          startTime: m.startTime,
          match: m,
          dataWarnings: warnings,
        };
      })(),
    );
  }

  const matches = await Promise.all(matchItems.slice(0, 10));

  const lightDeferred: SlateItem[] = deferred.map((p) => ({
    id: p.id,
    kind: "prop",
    sport: p.sport,
    league: p.league,
    platform: p.platform,
    title: `${p.playerName} · ${p.statLabel}`,
    subtitle: `${p.league} · line ${p.line} · not yet analyzed`,
    line: p.line,
    startTime: p.startTime,
    prop: p,
    dataWarnings: ["Open dossier to run wholesale analysis"],
  }));

  const items = [...analyzed, ...matches, ...lightDeferred].sort(
    (a, b) => (b.edge ?? -999) - (a.edge ?? -999),
  );

  const detail = [
    pp.blocked ? "PrizePicks blocked — paste lines" : pp.detail,
    poly.detail,
    odds.detail,
  ].join(" · ");

  return { items, statuses, detail };
}