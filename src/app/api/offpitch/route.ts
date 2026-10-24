import { synthesizeOffPitch } from "@/lib/analysis/offpitch";
import type { Sport } from "@/lib/types";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    sport: Sport;
    subject: string;
    context: string;
    team?: string;
    opponent?: string;
  };
  const digest = await synthesizeOffPitch(body);
  return NextResponse.json({ digest });
}