import { promises as fs } from "fs";
import path from "path";

const CACHE_DIR = path.join(process.cwd(), ".cache");

type CacheEnvelope<T> = {
  expiresAt: number;
  data: T;
};

async function ensureDir() {
  await fs.mkdir(CACHE_DIR, { recursive: true });
}

function safeKey(key: string) {
  return key.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const file = path.join(CACHE_DIR, `${safeKey(key)}.json`);
    const raw = await fs.readFile(file, "utf8");
    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    if (Date.now() > parsed.expiresAt) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export async function cacheSet<T>(
  key: string,
  data: T,
  ttlSeconds: number,
): Promise<void> {
  await ensureDir();
  const file = path.join(CACHE_DIR, `${safeKey(key)}.json`);
  const envelope: CacheEnvelope<T> = {
    expiresAt: Date.now() + ttlSeconds * 1000,
    data,
  };
  await fs.writeFile(file, JSON.stringify(envelope), "utf8");
}

export async function cacheClear(): Promise<number> {
  await ensureDir();
  const files = await fs.readdir(CACHE_DIR);
  let cleared = 0;
  for (const f of files) {
    if (!f.endsWith(".json")) continue;
    await fs.unlink(path.join(CACHE_DIR, f));
    cleared += 1;
  }
  return cleared;
}

export async function withCache<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
): Promise<{ data: T; cached: boolean }> {
  const hit = await cacheGet<T>(key);
  if (hit !== null) return { data: hit, cached: true };
  const data = await loader();
  await cacheSet(key, data, ttlSeconds);
  return { data, cached: false };
}