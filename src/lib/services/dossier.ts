import {
  fetchSoccerPlayerLogs,
  fetchSoccerTeamForm,
} from "@/lib/adapters/api-football";
import { fetchNbaPlayerLogs } from "@/lib/adapters/espn-nba";
import { synthesizeOffPitch } from "@/lib/analysis/offpitch";
import {
  buildMatchScorecard,
  buildPropScorecard,
} from "@/lib/analysis/scorecard";
import type { MatchMarket, PropLine, Scorecard } from "@/lib/types";

export async function analyzeProp(
  prop: PropLine,
  opts?: { withOffPitch?: boolean },
): Promise<Scorecard> {
  const warnings: string[] = [];
  const logs =
    prop.sport === "nba"
      ? await fetchNbaPlayerLogs(prop.playerName, prop.statType, 30)
      : await fetchSoccerPlayerLogs(
          prop.playerName,
          prop.league,
          prop.statType,
          20,
        );
  warnings.push(...logs.warnings);

  let offPitch;
  if (opts?.withOffPitch !== false) {
    offPitch = await synthesizeOffPitch({
      sport: prop.sport,
      subject: prop.playerName,
      team: prop.team,
      opponent: prop.opponent,
      context: `${prop.statLabel} ${prop.side ?? "over/under"} ${prop.line} on ${prop.platform}`,
    });
  }

  return buildPropScorecard({
    prop,
    logs: logs.logs,
    offPitch,
    warnings,
  });
}

export async function analyzeMatch(
  match: MatchMarket,
  opts?: { withOffPitch?: boolean },
): Promise<Scorecard> {
  const warnings: string[] = [];
  let homeForm = { logs: [] as Awaited<ReturnType<typeof fetchSoccerTeamForm>>["logs"], warnings: [] as string[] };
  let awayForm = { logs: [] as typeof homeForm.logs, warnings: [] as string[] };

  if (match.sport === "soccer") {
    homeForm = await fetchSoccerTeamForm(match.homeTeam, match.league);
    awayForm = await fetchSoccerTeamForm(match.awayTeam, match.league);
    warnings.push(...homeForm.warnings, ...awayForm.warnings);
  }

  let offPitch;
  if (opts?.withOffPitch !== false) {
    offPitch = await synthesizeOffPitch({
      sport: match.sport,
      subject: `${match.awayTeam} vs ${match.homeTeam}`,
      team: match.homeTeam,
      opponent: match.awayTeam,
      context: `Match winner market on ${match.platform}; implied home ${(match.impliedHome * 100).toFixed(0)}%`,
    });
  }

  return buildMatchScorecard({
    match,
    homeForm: homeForm.logs,
    awayForm: awayForm.logs,
    offPitch,
    warnings,
  });
}