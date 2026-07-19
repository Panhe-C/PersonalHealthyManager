type Bucket = {
  count: number;
  resetAt: number;
};

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

const globalState = globalThis as typeof globalThis & {
  __hbmRateLimitBuckets?: Map<string, Bucket>;
};

const buckets = globalState.__hbmRateLimitBuckets ?? new Map<string, Bucket>();
globalState.__hbmRateLimitBuckets = buckets;

function pruneExpired(now: number) {
  if (buckets.size < 1_000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function consumeRateLimit(options: RateLimitOptions): RateLimitResult {
  const now = options.now ?? Date.now();
  pruneExpired(now);
  const current = buckets.get(options.key);
  const bucket = !current || current.resetAt <= now
    ? { count: 0, resetAt: now + options.windowMs }
    : current;

  bucket.count += 1;
  buckets.set(options.key, bucket);
  const remaining = Math.max(0, options.limit - bucket.count);

  return {
    allowed: bucket.count <= options.limit,
    limit: options.limit,
    remaining,
    resetAt: bucket.resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1_000)),
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
    ...(result.allowed ? {} : { "Retry-After": String(result.retryAfterSeconds) }),
  };
}

export function resetRateLimitsForTests() {
  buckets.clear();
}
