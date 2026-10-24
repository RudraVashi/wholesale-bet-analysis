/** Display times in America/Chicago (user locale). */
export function formatKickoff(iso?: string | null): string {
  if (!iso) return "Time TBD";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Time TBD";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(d);
}

export function formatKickoffShort(iso?: string | null): string {
  if (!iso) return "TBD";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "TBD";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

export function gameGroupKey(item: {
  kind: string;
  startTime?: string;
  title: string;
  match?: { homeTeam: string; awayTeam: string };
  prop?: { team?: string; opponent?: string; playerName?: string };
}): string {
  if (item.match) {
    return `${item.match.awayTeam} @ ${item.match.homeTeam}`;
  }
  if (item.prop?.opponent && item.prop?.team) {
    return `${item.prop.team} vs ${item.prop.opponent}`;
  }
  // Fall back to start date bucket + title stem
  const day = item.startTime?.slice(0, 10) ?? "unknown";
  return `${day} · ${item.title}`;
}