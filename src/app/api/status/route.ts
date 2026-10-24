import { getSourceStatus } from "@/lib/services/slate";
import { cacheClear } from "@/lib/cache/fs-cache";
import { NextResponse } from "next/server";

export async function GET() {
  const statuses = await getSourceStatus();
  return NextResponse.json({ statuses });
}

export async function DELETE() {
  const cleared = await cacheClear();
  return NextResponse.json({ cleared });
}