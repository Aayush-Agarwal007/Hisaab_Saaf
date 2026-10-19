import "server-only";

type RateLimitRecord = {
  count: number;
  resetAt: number;
};

const globalForRateLimit = globalThis as typeof globalThis & {
  recoveryRateLimits?: Map<string, RateLimitRecord>;
};

const rateLimits =
  globalForRateLimit.recoveryRateLimits ??
  (globalForRateLimit.recoveryRateLimits = new Map());

const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS = 5;

export function checkRecoveryRateLimit(key: string) {
  const now = Date.now();
  const current = rateLimits.get(key);

  if (!current || now >= current.resetAt) {
    rateLimits.set(key, {
      count: 1,
      resetAt: now + WINDOW_MS,
    });

    return {
      allowed: true,
      retryAfterSeconds: 0,
    };
  }

  if (current.count >= MAX_REQUESTS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((current.resetAt - now) / 1000),
    };
  }

  current.count += 1;

  return {
    allowed: true,
    retryAfterSeconds: 0,
  };
}