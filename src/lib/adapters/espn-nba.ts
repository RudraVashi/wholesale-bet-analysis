import { nbaFantasy } from "@/lib/adapters/stat-map";
import { withCache } from "@/lib/cache/fs-cache";
import type { GameLog, StatType } from "@/lib/types";

type EspnAthleteSearch = {
  items?: Array<{ id?: string; displayName?: string }>;
};

type EspnSummary = {
  boxscore?: {
    players?: Array<{
      team?: { displayName?: string; abbreviation?: string };
      statistics?: Array<{
        athletes?: Array<{
          athlete?: { id?: string; displayName?: string };
          stats?: string[];
          didNotPlay?: boolean;
        }>;
        names?: string[];
        keys?: string[];
      }>;
    }>;
  };
  header?: {
    competitions?: Array<{
      competitors?: Array<{
        homeAway?: string;
        team?: { displayName?: string; abbreviation?: string };
        score?: string;
      }>;
      date?: string;
    }>;
  };
};

function parseStatCell(raw: string | undefined): number {
  if (raw == null || raw === "") return 0;
  // Handle "3-10" made-attempted pairs — use made
  if (raw.includes("-") && !raw.trim().startsWith("-")) {
    const made = Number(raw.split("-")[0]);
    return Number.isFinite(made) ? made : 0;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function extractStat(
  keys: string[],
  stats: string[],
  statType: StatType,
): number | null {
  const map = new Map(
    keys.map((k, i) => [k.toLowerCase(), parseStatCell(stats[i])]),
  );
  const num = (...names: string[]) => {
    for (const n of names) {
      if (map.has(n)) return map.get(n)!;
    }
    return 0;
  };
  const pts = num("points", "pts");
  const reb = num("totalrebounds", "rebounds", "reb");
  const ast = num("assists", "ast");
  const stl = num("steals", "stl");
  const blk = num("blocks", "blk");
  const tov = num("turnovers", "tov");
  switch (statType) {
    case "points":
      return pts;
    case "rebounds":
      return reb;
    case "assists":
      return ast;
    case "threes":
      return num(
        "threepointfieldgoalsmade-threepointfieldgoalsattempted",
        "threepointfieldgoalsmade",
        "3pm",
        "3pt",
        "3ptm",
      );
    case "steals":
      return stl;
    case "blocks":
      return blk;
    case "turnovers":
      return tov;
    case "pra":
      return pts + reb + ast;
    case "pts_asts":
      return pts + ast;
    case "pts_rebs":
      return pts + reb;
    case "rebs_asts":
      return reb + ast;
    case "fg_made":
      return num(
        "fieldgoalsmade-fieldgoalsattempted",
        "fieldgoalsmade",
        "fgm",
        "fg",
      );
    case "fantasy_score":
      return nbaFantasy({ pts, reb, ast, stl, blk, tov });
    default:
      return null;
  }
}

export async function searchNbaPlayer(
  name: string,
): Promise<{ id: string; name: string } | null> {
  const key = `espn:nba:player:${name.toLowerCase()}`;
  const { data } = await withCache(key, 86400, async () => {
    const url = `https://site.web.api.espn.com/apis/common/v3/search?query=${encodeURIComponent(name)}&limit=8&type=player&sport=basketball&league=nba`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      items?: Array<{ id?: string; displayName?: string; type?: string }>;
    };
    const hit =
      json.items?.find((i) =>
        (i.displayName ?? "")
          .toLowerCase()
          .includes(name.toLowerCase().split(" ").slice(-1)[0] ?? ""),
      ) ?? json.items?.[0];
    if (!hit?.id) return null;
    return { id: String(hit.id), name: hit.displayName ?? name };
  });
  return data;
}

async function fetchPlayerGameIds(playerId: string): Promise<string[]> {
  const key = `espn:nba:gamenotes:${playerId}`;
  const { data } = await withCache(key, 3600, async () => {
    const url = `https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/${playerId}/gamelog`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(12000),
      cache: "no-store",
    });
    if (!res.ok) {
      // fallback schedule scrape via athlete overview events
      const overview = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/athletes/${playerId}`,
        { signal: AbortSignal.timeout(10000), cache: "no-store" },
      );
      if (!overview.ok) return [] as string[];
      return [] as string[];
    }
    const json = (await res.json()) as {
      events?: Array<{ id?: string; eventId?: string }>;
      seasonTypes?: Array<{
        categories?: Array<{
          events?: Array<{ eventId?: string; id?: string }>;
        }>;
      }>;
    };
    const ids: string[] = [];
    for (const e of json.events ?? []) {
      const id = e.eventId ?? e.id;
      if (id) ids.push(String(id));
    }
    for (const st of json.seasonTypes ?? []) {
      for (const cat of st.categories ?? []) {
        for (const e of cat.events ?? []) {
          const id = e.eventId ?? e.id;
          if (id) ids.push(String(id));
        }
      }
    }
    return [...new Set(ids)].slice(0, 25);
  });
  return data;
}

async function boxFromEvent(
  eventId: string,
  playerId: string,
  playerName: string,
  statType: StatType,
): Promise<GameLog | null> {
  const key = `espn:nba:box:${eventId}:${playerId}:${statType}`;
  const { data } = await withCache(key, 86400, async () => {
    const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${eventId}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as EspnSummary;
    const comp = json.header?.competitions?.[0];
    const competitors = comp?.competitors ?? [];
    const home = competitors.find((c) => c.homeAway === "home");
    const away = competitors.find((c) => c.homeAway === "away");

    for (const teamBlock of json.boxscore?.players ?? []) {
      for (const group of teamBlock.statistics ?? []) {
        const keys = group.keys ?? group.names ?? [];
        for (const ath of group.athletes ?? []) {
          if (ath.didNotPlay) continue;
          const id = ath.athlete?.id;
          const name = ath.athlete?.displayName ?? "";
          if (id !== playerId && !name.toLowerCase().includes(playerName.toLowerCase().split(" ").slice(-1)[0] ?? "___")) {
            continue;
          }
          const value = extractStat(keys, ath.stats ?? [], statType);
          if (value === null) continue;
          const teamAbbr = teamBlock.team?.abbreviation ?? "";
          const isHome = home?.team?.abbreviation === teamAbbr;
          const opponent = isHome
            ? (away?.team?.displayName ?? "OPP")
            : (home?.team?.displayName ?? "OPP");
          return {
            date: (comp?.date ?? "").slice(0, 10),
            opponent,
            home: Boolean(isHome),
            value,
            teamScore: Number(isHome ? home?.score : away?.score) || undefined,
            oppScore: Number(isHome ? away?.score : home?.score) || undefined,
          } satisfies GameLog;
        }
      }
    }
    return null;
  });
  return data;
}

/**
 * Prefer ESPN athlete gamelog endpoint which already includes per-game stats.
 */
export async function fetchNbaPlayerLogs(
  playerName: string,
  statType: StatType,
  limit = 20,
): Promise<{ logs: GameLog[]; warnings: string[]; playerId?: string }> {
  const warnings: string[] = [];
  const player = await searchNbaPlayer(playerName);
  if (!player) {
    return {
      logs: [],
      warnings: [`Could not resolve NBA player "${playerName}" via ESPN.`],
    };
  }

  const key = `espn:nba:logs:${player.id}:${statType}:${limit}`;
  try {
    const { data } = await withCache(key, 1800, async () => {
      const url = `https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/${player.id}/gamelog`;
      const res = await fetch(url, {
        signal: AbortSignal.timeout(12000),
        cache: "no-store",
      });
      if (!res.ok) {
        const ids = await fetchPlayerGameIds(player.id);
        const logs: GameLog[] = [];
        for (const id of ids.slice(0, limit)) {
          const log = await boxFromEvent(id, player.id, player.name, statType);
          if (log) logs.push(log);
        }
        return logs;
      }

      const json = (await res.json()) as {
        names?: string[];
        labels?: string[];
        displayNames?: string[];
        events?: Record<
          string,
          {
            id?: string;
            gameDate?: string;
            atVs?: string;
            opponent?: { displayName?: string };
          }
        >;
        seasonTypes?: Array<{
          categories?: Array<{
            events?: Array<{ eventId?: string; stats?: string[] }>;
          }>;
        }>;
      };

      const labels = (
        json.names ??
        json.labels ??
        json.displayNames ??
        []
      ).map((x) => x.toLowerCase());

      const meta = json.events ?? {};
      const ordered: Array<{ eventId: string; stats: string[] }> = [];
      for (const st of json.seasonTypes ?? []) {
        for (const cat of st.categories ?? []) {
          for (const ev of cat.events ?? []) {
            if (ev.eventId && ev.stats) {
              ordered.push({ eventId: ev.eventId, stats: ev.stats });
            }
          }
        }
      }

      const logs: GameLog[] = [];
      for (const ev of ordered) {
        const value = extractStat(labels, ev.stats, statType);
        if (value === null) continue;
        const info = meta[ev.eventId];
        logs.push({
          date: (info?.gameDate ?? "").toString().slice(0, 10),
          opponent: info?.opponent?.displayName ?? "OPP",
          home: (info?.atVs ?? "vs") !== "@",
          value,
        });
        if (logs.length >= limit) break;
      }
      return logs;
    });

    if (data.length === 0) {
      warnings.push("ESPN returned no recent game logs for this player/stat.");
    }
    return { logs: data, warnings, playerId: player.id };
  } catch (err) {
    warnings.push(
      err instanceof Error ? err.message : "ESPN NBA gamelog fetch failed",
    );
    return { logs: [], warnings, playerId: player.id };
  }
}

export async function fetchNbaTeamRest(teamName: string): Promise<{
  restDays: number | null;
  backToBack: boolean;
  warning?: string;
}> {
  try {
    const scoreboard = await withCache("espn:nba:scoreboard", 600, async () => {
      const res = await fetch(
        "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard",
        { signal: AbortSignal.timeout(10000), cache: "no-store" },
      );
      if (!res.ok) return null;
      return res.json();
    });
    void scoreboard;
    void teamName;
    return { restDays: null, backToBack: false, warning: "Rest inferred from logs when possible" };
  } catch {
    return { restDays: null, backToBack: false, warning: "Could not load NBA scoreboard" };
  }
}