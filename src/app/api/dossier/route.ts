import { analyzeMatch, analyzeProp } from "@/lib/services/dossier";
import type { MatchMarket, PropLine } from "@/lib/types";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    kind: "prop" | "match";
    prop?: PropLine;
    match?: MatchMarket;
    withOffPitch?: boolean;
  };

  if (body.kind === "prop" && body.prop) {
    const scorecard = await analyzeProp(body.prop, {
      withOffPitch: body.withOffPitch,
    });
    return NextResponse.json({ scorecard });
  }
  if (body.kind === "match" && body.match) {
    const scorecard = await analyzeMatch(body.match, {
      withOffPitch: body.withOffPitch,
    });
    return NextResponse.json({ scorecard });
  }
  return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
}