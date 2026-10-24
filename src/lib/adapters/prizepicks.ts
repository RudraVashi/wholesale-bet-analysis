import { normalizeStatType, statLabel } from "@/lib/adapters/stat-map";
import { withCache } from "@/lib/cache/fs-cache";
import type { PropLine, Sport } from "@/lib/types";

/** Common PrizePicks league IDs (community-sourced; may drift). */
export const PP_LEAGUES: Record<
  string,
  { id: string; sport: Sport; league: string }
> = {
  nba: { id: "7", sport: "nba", league: "NBA" },
  epl: { id: "82", sport: "soccer", league: "EPL" },
  la_liga: { id: "84", sport: "soccer", league: "La Liga" },
  soccer: { id: "82", sport: "soccer", league: "Soccer" },
};

type PpResponse = {
  data?: Array<{
    id: string;
    attributes: {
      line_score: number;
      stat_type: string;
      start_time?: string;
      odds_type?: string;
      board_time?: string;
    };
    relationships?: {
      new_player?: { data?: { id: string } };
    };
  }>;
  included?: Array<{
    id: string;
    type: string;
    attributes: Record<string, unknown>;
  }>;
};

export type PrizePicksFetchResult = {
  props: PropLine[];
  ok: boolean;
  blocked: boolean;
  detail: string;
};

async function fetchLeague(leagueKey: string): Promise<PrizePicksFetchResult> {
  const meta = PP_LEAGUES[leagueKey];
  if (!meta) {
    return { props: [], ok: false, blocked: false, detail: "Unknown league" };
  }

  const url = new URL("https://api.prizepicks.com/projections");
  url.searchParams.set("league_id", meta.id);
  url.searchParams.set("single_stat", "true");
  url.searchParams.set("per_page", "250");

  try {
    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
      signal: AbortSignal.timeout(12000),
      cache: "no-store",
    });

    if (res.status === 403 || res.status === 401) {
      return {
        props: [],
        ok: false,
        blocked: true,
        detail: `PrizePicks blocked this IP (${res.status}). Use manual paste.`,
      };
    }
    if (!res.ok) {
      return {
        props: [],
        ok: false,
        blocked: false,
        detail: `PrizePicks HTTP ${res.status}`,
      };
    }

    const json = (await res.json()) as PpResponse;
    const players = new Map<
      string,
      { name: string; team: string; position?: string }
    >();
    for (const item of json.included ?? []) {
      if (item.type === "new_player") {
        players.set(item.id, {
          name: String(item.attributes.display_name ?? "Unknown"),
          team: String(item.attributes.team ?? ""),
          position: item.attributes.position
            ? String(item.attributes.position)
            : undefined,
        });
      }
    }

    const props: PropLine[] = [];
    for (const proj of json.data ?? []) {
      const oddsType = proj.attributes.odds_type ?? "standard";
      if (oddsType !== "standard") continue;
      const playerId = proj.relationships?.new_player?.data?.id;
      const player = playerId ? players.get(playerId) : undefined;
      const rawStat = proj.attributes.stat_type ?? "other";
      const statType = normalizeStatType(rawStat);
      props.push({
        id: `pp-${meta.league}-${proj.id}`,
        platform: "prizepicks",
        sport: meta.sport,
        league: meta.league,
        playerName: player?.name ?? "Unknown",
        team: player?.team ?? "",
        startTime: proj.attributes.start_time,
        statType,
        statLabel: statLabel(statType, rawStat),
        line: Number(proj.attributes.line_score),
        source: "prizepicks",
      });
    }

    return {
      props,
      ok: true,
      blocked: false,
      detail: `${props.length} standard props from ${meta.league}`,
    };
  } catch (err) {
    return {
      props: [],
      ok: false,
      blocked: false,
      detail: err instanceof Error ? err.message : "PrizePicks fetch failed",
    };
  }
}

export async function fetchPrizePicksBoard(
  leagues: string[] = ["nba", "epl", "la_liga"],
): Promise<PrizePicksFetchResult> {
  const cacheKey = `prizepicks:${leagues.sort().join(",")}`;
  const { data } = await withCache(cacheKey, 120, async () => {
    const results = await Promise.all(leagues.map((l) => fetchLeague(l)));
    const blocked = results.some((r) => r.blocked);
    const props = results.flatMap((r) => r.props);
    const ok = results.some((r) => r.ok);
    const detail = results.map((r) => r.detail).join(" · ");
    return { props, ok, blocked, detail };
  });
  return data;
}

export function parseManualProps(
  text: string,
  defaults: { sport: Sport; league: string },
): PropLine[] {
  const lines = text
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const out: PropLine[] = [];

  for (const [i, line] of lines.entries()) {
    // Formats:
    // Player | STAT | 22.5 | over?
    // Player, STAT, 22.5
    // Player STAT 22.5
    const parts = line.includes("|")
      ? line.split("|").map((p) => p.trim())
      : line.includes(",")
        ? line.split(",").map((p) => p.trim())
        : line.match(/^(.+?)\s+([A-Za-z+]+(?:\s+[A-Za-z]+)*)\s+(\d+(?:\.\d+)?)\s*(over|under)?$/i);

    let playerName = "";
    let statRaw = "";
    let lineNum = NaN;
    let side: "over" | "under" | undefined;

    if (Array.isArray(parts) && parts.length >= 3 && !("index" in parts)) {
      playerName = parts[0] ?? "";
      statRaw = parts[1] ?? "";
      lineNum = Number(parts[2]);
      const s = (parts[3] ?? "").toLowerCase();
      if (s === "over" || s === "under") side = s;
    } else if (parts && "index" in (parts as RegExpMatchArray)) {
      const m = parts as RegExpMatchArray;
      playerName = m[1]?.trim() ?? "";
      statRaw = m[2]?.trim() ?? "";
      lineNum = Number(m[3]);
      const s = (m[4] ?? "").toLowerCase();
      if (s === "over" || s === "under") side = s as "over" | "under";
    }

    if (!playerName || !statRaw || Number.isNaN(lineNum)) continue;
    const statType = normalizeStatType(statRaw);
    out.push({
      id: `manual-${Date.now()}-${i}`,
      platform: "manual",
      sport: defaults.sport,
      league: defaults.league,
      playerName,
      team: "",
      statType,
      statLabel: statLabel(statType, statRaw),
      line: lineNum,
      side,
      source: "manual",
    });
  }
  return out;
}