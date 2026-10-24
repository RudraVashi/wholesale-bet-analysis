import { parseManualProps } from "@/lib/adapters/prizepicks";
import { buildSlate } from "@/lib/services/slate";
import type { LeagueFilter, Sport } from "@/lib/types";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const filter = (req.nextUrl.searchParams.get("filter") ??
    "all") as LeagueFilter;
  const result = await buildSlate({ filter });
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    filter?: LeagueFilter;
    manualText?: string;
    sport?: Sport;
    league?: string;
  };
  const manualProps = body.manualText
    ? parseManualProps(body.manualText, {
        sport: body.sport ?? "nba",
        league: body.league ?? (body.sport === "soccer" ? "EPL" : "NBA"),
      })
    : [];
  const result = await buildSlate({
    filter: body.filter ?? "all",
    manualProps,
  });
  return NextResponse.json({ ...result, manualCount: manualProps.length });
}