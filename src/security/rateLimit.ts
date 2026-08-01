import {
  getRateLimitStore,
  resetRateLimitStoreForTests,
  resolveRateLimitStore,
  setRateLimitStore
} from "@/src/security/rateLimitStore";

setRateLimitStore(resolveRateLimitStore());

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
  now?: number;
};

type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
};

export function consumeRateLimit(options: RateLimitOptions): RateLimitResult {
  const now = options.now ?? Date.now();
  const store = getRateLimitStore();
  const bucketOrPromise = store.consume(options.key, options.limit, options.windowMs, now);

  // The default memory store is synchronous; Redis is async. Callers today are
  // sync API routes, so we only accept a Promise when the result is already
  // settled (tests) and otherwise require the sync memory path. Async Redis
  // call sites should use consumeRateLimitAsync.
  if (bucketOrPromise instanceof Promise) {
    throw new Error("Use consumeRateLimitAsync when the rate-limit store is asynchronous");
  }

  const bucket = bucketOrPromise;
  const remaining = Math.max(0, options.limit - bucket.count);
  return {
    allowed: bucket.count <= options.limit,
    limit: options.limit,
    remaining,
    resetAt: bucket.resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1_000))
  };
}

export async function consumeRateLimitAsync(options: RateLimitOptions): Promise<RateLimitResult> {
  const now = options.now ?? Date.now();
  const bucket = await getRateLimitStore().consume(options.key, options.limit, options.windowMs, now);
  const remaining = Math.max(0, options.limit - bucket.count);
  return {
    allowed: bucket.count <= options.limit,
    limit: options.limit,
    remaining,
    resetAt: bucket.resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1_000))
  };
}

export function requestClientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function rateLimitHeaders(result: RateLimitResult) {
  return {
    "RateLimit-Limit": String(result.limit),
    "RateLimit-Remaining": String(result.remaining),
    "RateLimit-Reset": String(Math.ceil(result.resetAt / 1_000)),
    ...(result.allowed ? {} : { "Retry-After": String(result.retryAfterSeconds) })
  };
}

export function resetRateLimitsForTests() {
  resetRateLimitStoreForTests();
}
