import { GoogleGenerativeAI } from "@google/generative-ai";
import { withCache } from "@/lib/cache/fs-cache";
import type { OffPitchDigest, Sport } from "@/lib/types";
import { clamp } from "@/lib/utils";

export function geminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}

function fallbackDigest(reason: string): OffPitchDigest {
  return {
    score: 50,
    lean: "neutral",
    summary: reason,
    bullets: [],
    severity: "low",
  };
}

export async function synthesizeOffPitch(input: {
  sport: Sport;
  subject: string;
  context: string;
  team?: string;
  opponent?: string;
}): Promise<OffPitchDigest> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return fallbackDigest(
      "Add GEMINI_API_KEY for off-pitch news synthesis.",
    );
  }

  const cacheKey = `offpitch:${input.sport}:${input.subject}:${input.context}`.slice(
    0,
    180,
  );

  try {
    const { data } = await withCache(cacheKey, 1800, async () => {
      const genAI = new GoogleGenerativeAI(key);
      const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
      });

      const prompt = `You are an off-pitch / off-court analyst for a fun betting research desk (not financial advice).
Sport: ${input.sport}
Subject: ${input.subject}
Team: ${input.team ?? "n/a"}
Opponent: ${input.opponent ?? "n/a"}
Bet context: ${input.context}

Using your knowledge of recent public news (injuries, suspensions, lineup changes, rest/travel, coaching, locker-room, transfers/trades, weather for soccer), return STRICT JSON only:
{
  "score": 0-100 (50=neutral; higher = clearer actionable signal),
  "lean": "over"|"under"|"home"|"away"|"neutral",
  "summary": "one short sentence",
  "bullets": ["3-5 short factual bullets"],
  "severity": "low"|"medium"|"high",
  "sources": ["optional outlet names"]
}
If unsure, lean neutral and severity low. Do not invent specific injury statuses you are not confident about.`;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return fallbackDigest("Gemini returned non-JSON off-pitch note.");
      }
      const parsed = JSON.parse(jsonMatch[0]) as Partial<OffPitchDigest>;
      return {
        score: clamp(Number(parsed.score ?? 50)),
        lean: (parsed.lean as OffPitchDigest["lean"]) ?? "neutral",
        summary: String(parsed.summary ?? "No clear off-pitch signal"),
        bullets: Array.isArray(parsed.bullets)
          ? parsed.bullets.map(String).slice(0, 6)
          : [],
        severity: (parsed.severity as OffPitchDigest["severity"]) ?? "low",
        sources: Array.isArray(parsed.sources)
          ? parsed.sources.map(String)
          : undefined,
      } satisfies OffPitchDigest;
    });
    return data;
  } catch (err) {
    return fallbackDigest(
      err instanceof Error ? `Off-pitch failed: ${err.message}` : "Off-pitch failed",
    );
  }
}