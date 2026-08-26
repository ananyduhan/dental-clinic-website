import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { RateLimitError } from "@/lib/errors";

/**
 * Rate limiters for auth and booking endpoints.
 *
 * Everything here is constructed lazily. The previous version built the Redis
 * client and both limiters at module scope using `process.env.UPSTASH_...!`,
 * which meant that merely *importing* this file with the env unset threw — so a
 * missing credential broke the build and every test that touched a module in the
 * same import graph, rather than the one request that needed rate limiting.
 */

let redisClient: Redis | null = null;

/**
 * @returns the shared Redis client, or `null` when Upstash is not configured.
 */
function getRedis(): Redis | null {
  if (redisClient) return redisClient;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  redisClient = new Redis({ url, token });
  return redisClient;
}

/**
 * Per-endpoint limits, transcribed from the table in docs/security.md.
 *
 * The identifier passed to `checkRateLimit` decides what each one counts:
 * `login` is documented as per-IP *and* per-email, so callers check it twice
 * with different identifiers.
 */
const LIMITS = {
  login: { window: Ratelimit.slidingWindow(5, "15 m"), prefix: "ratelimit:login" },
  register: { window: Ratelimit.slidingWindow(3, "1 h"), prefix: "ratelimit:register" },
  forgotPassword: { window: Ratelimit.slidingWindow(3, "1 h"), prefix: "ratelimit:forgot" },
  resetPassword: { window: Ratelimit.slidingWindow(5, "1 h"), prefix: "ratelimit:reset" },
  booking: { window: Ratelimit.slidingWindow(10, "1 h"), prefix: "ratelimit:booking" },
  export: { window: Ratelimit.slidingWindow(20, "1 d"), prefix: "ratelimit:export" },
  publicApi: { window: Ratelimit.slidingWindow(60, "1 m"), prefix: "ratelimit:public" },
} as const;

export type RateLimitName = keyof typeof LIMITS;

const cache = new Map<RateLimitName, Ratelimit | null>();

/**
 * @returns the named limiter, or `null` when Upstash is not configured.
 */
export function getRateLimiter(name: RateLimitName): Ratelimit | null {
  const cached = cache.get(name);
  if (cached !== undefined) return cached;

  const redis = getRedis();
  const limiter = redis
    ? new Ratelimit({
        redis,
        limiter: LIMITS[name].window,
        analytics: true,
        prefix: LIMITS[name].prefix,
      })
    : null;

  cache.set(name, limiter);
  return limiter;
}

export interface RateLimitResult {
  success: boolean;
  /** Unix ms at which the current window resets. `0` when not enforced. */
  reset: number;
}

/**
 * Check a rate limit for `identifier` (usually an IP, or `ip:email` for login).
 *
 * Fails **open** when Upstash is unconfigured or unreachable: an outage at the
 * rate limiter should not take down login for everyone. In production this is a
 * real (if narrow) exposure, so it is logged rather than swallowed —
 * `docs/security.md` treats rate limiting as defence in depth, not the only lock
 * on the door.
 */
export async function checkRateLimit(
  name: RateLimitName,
  identifier: string,
): Promise<RateLimitResult> {
  const limiter = getRateLimiter(name);

  if (!limiter) {
    if (process.env.NODE_ENV === "production") {
      console.warn("[rate-limit] Upstash not configured — request allowed unchecked");
    }
    return { success: true, reset: 0 };
  }

  try {
    const { success, reset } = await limiter.limit(identifier);
    return { success, reset };
  } catch (error) {
    console.error("[rate-limit] limiter unavailable — failing open", error);
    return { success: true, reset: 0 };
  }
}

/**
 * Check a limit and throw `RateLimitError` if it has been exceeded.
 *
 * The error carries `resetAt` so the error handler can emit a `Retry-After`
 * header, which docs/security.md requires on every 429.
 */
export async function enforceRateLimit(name: RateLimitName, identifier: string): Promise<void> {
  const { success, reset } = await checkRateLimit(name, identifier);
  if (!success) {
    console.warn("[rate-limit] limit exceeded", { limit: name });
    throw new RateLimitError(undefined, reset);
  }
}

/**
 * Best-effort client IP.
 *
 * On Vercel `x-forwarded-for` is set by the platform and can be trusted. Behind
 * any other proxy it is client-controllable, so this must never be the only
 * thing gating a sensitive action — it buys friction, not authorization.
 */
export function clientIpFrom(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return headers.get("x-real-ip") ?? "unknown";
}
