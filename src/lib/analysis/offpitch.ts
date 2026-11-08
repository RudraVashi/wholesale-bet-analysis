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
      const today = new Date().toISOString().slice(0, 10);
      const nbaSeason =
        input.sport === "nba"
          ? (() => {
              const d = new Date();
              const y = d.getUTCFullYear();
              const m = d.getUTCMonth(); // 0-based
              // NBA season label flips around August
              return m >= 7 ? `${y}-${String(y + 1).slice(2)}` : `${y - 1}-${String(y).slice(2)}`;
            })()
          : null;
      const prompt = `You are an off-pitch / off-court analyst for a fun betting research desk (not financial advice).
Today's date (UTC): ${today}
${nbaSeason ? `Current NBA season label: ${nbaSeason}` : ""}
Sport: ${input.sport}
Subject: ${input.subject}
Team: ${input.team ?? "n/a"}
Opponent: ${input.opponent ?? "n/a"}
Bet context: ${input.context}

Using only knowledge you are confident is still true as of ${today}, consider injuries, suspensions, lineup changes, rest/travel, coaching, locker-room, transfers/trades, weather for soccer. Return STRICT JSON only:
{
  "score": 0-100 (50=neutral; higher = clearer actionable signal),
  "lean": "over"|"under"|"home"|"away"|"neutral",
  "summary": "one short sentence",
  "bullets": ["3-5 short factual bullets"],
  "severity": "low"|"medium"|"high",
  "sources": ["optional outlet names"]
}
Hard rules:
- Do NOT invent or guess current injury statuses.
- Do NOT cite last year's season as current (e.g. do not say someone is out for 2024-25 when today is ${today}).
- If your knowledge may be stale or you are unsure whether a player is available now, lean neutral, severity low, and say you lack a confirmed current update — do not state outdated injuries as fact.`;

      const text = await generateWithFallback(key, prompt);
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

/**
 * Prefer models that still accept new free-tier keys.
 * gemini-2.5-flash / gemini-flash-latest often 404 or 503 for new accounts.
 */
const GEMINI_MODELS = [
  "gemini-3.5-flash",
  "gemini-flash-lite-latest",
  "gemini-3.8-flash",
  "gemini-flash-latest",
];

const GEMINI_ATTEMPT_MS = 20_000;

function isRetryableGeminiError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /404|503|429|high demand|unavailable|overloaded|no longer available|try again|not found|aborted|timed out/i.test(
    message,
  );
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} timed out after ${ms}ms`)),
          ms,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function generateWithFallback(apiKey: string, prompt: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  let lastError: unknown;
  for (const modelName of GEMINI_MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await withTimeout(
        model.generateContent(prompt),
        GEMINI_ATTEMPT_MS,
        modelName,
      );
      return result.response.text();
    } catch (err) {
      lastError = err;
      if (!isRetryableGeminiError(err)) throw err;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("All Gemini models failed for off-pitch");
}