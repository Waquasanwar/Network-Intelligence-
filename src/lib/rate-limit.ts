/**
 * Rate limiting for the few routes an attacker hammers: sign-in, and other
 * unauthenticated or mutating endpoints.
 *
 * In production on Vercel there is no shared process memory between invocations, so a limiter
 * has to live in a shared store. When `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` are
 * set, we use Upstash Redis (works from the edge and serverless alike). With no Redis configured
 * — local dev, a single long-running instance — we fall back to an in-process sliding window,
 * which is correct for one instance and best-effort otherwise. The fallback means the app runs
 * with zero extra setup, while a real deployment gets a real distributed limiter by adding two
 * environment variables.
 */
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export type RateResult = { success: boolean; remaining: number; resetMs: number };

const hasRedis = !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

/** Named limiters. Sign-in is deliberately tight; general mutations are looser. */
const redisLimiters = hasRedis
  ? {
      signin: new Ratelimit({ redis: Redis.fromEnv(), limiter: Ratelimit.slidingWindow(12, "5 m"), prefix: "rl:signin", analytics: false }),
      mutate: new Ratelimit({ redis: Redis.fromEnv(), limiter: Ratelimit.slidingWindow(60, "1 m"), prefix: "rl:mutate", analytics: false }),
    }
  : null;

const WINDOWS = { signin: { limit: 12, windowMs: 5 * 60_000 }, mutate: { limit: 60, windowMs: 60_000 } } as const;
export type LimiterName = keyof typeof WINDOWS;

// In-process fallback: key -> hit timestamps within the window.
const mem = new Map<string, number[]>();
let lastSweep = 0;

function memoryLimit(name: LimiterName, key: string): RateResult {
  const { limit, windowMs } = WINDOWS[name];
  const now = Date.now();
  if (now - lastSweep > 60_000) {
    for (const [k, v] of mem) if (v.every((t) => now - t > windowMs)) mem.delete(k);
    lastSweep = now;
  }
  const full = `${name}:${key}`;
  const hits = (mem.get(full) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    mem.set(full, hits);
    return { success: false, remaining: 0, resetMs: hits[0] + windowMs - now };
  }
  hits.push(now);
  mem.set(full, hits);
  return { success: true, remaining: limit - hits.length, resetMs: windowMs };
}

/** Check a request against a named limiter, keyed (normally) by client IP. */
export async function rateLimit(name: LimiterName, key: string): Promise<RateResult> {
  if (redisLimiters) {
    const r = await redisLimiters[name].limit(`${name}:${key}`);
    return { success: r.success, remaining: r.remaining, resetMs: Math.max(0, r.reset - Date.now()) };
  }
  return memoryLimit(name, key);
}

/** Best-effort client IP from the proxy headers Vercel sets. */
export function clientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return headers.get("x-real-ip") ?? "unknown";
}
