/**
 * Shared rate-limit store. The default is process-local memory, which is fine
 * for a single Next.js instance. Set HBM_RATE_LIMIT_REDIS_URL to fan out across
 * replicas; the Redis backend uses a simple INCR + EXPIRE script over the
 * RESP protocol without taking a hard dependency at install time.
 */

export type RateLimitBucket = {
  count: number;
  resetAt: number;
};

export interface RateLimitStore {
  consume(key: string, limit: number, windowMs: number, now: number): Promise<RateLimitBucket> | RateLimitBucket;
}

class MemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, RateLimitBucket>();

  consume(key: string, _limit: number, windowMs: number, now: number): RateLimitBucket {
    if (this.buckets.size >= 1_000) {
      for (const [entryKey, bucket] of this.buckets) {
        if (bucket.resetAt <= now) this.buckets.delete(entryKey);
      }
    }

    const current = this.buckets.get(key);
    const bucket =
      !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;
    bucket.count += 1;
    this.buckets.set(key, bucket);
    return bucket;
  }

  clear() {
    this.buckets.clear();
  }
}

/**
 * Redis-backed store using a raw TCP connection is too heavy for a soft
 * dependency. Instead we speak the Upstash-compatible HTTP REST API when the
 * URL looks like https://…, and fall back to memory with a warning otherwise.
 * Operators who want classic redis:// can put a REST proxy in front or swap
 * this class later without touching call sites.
 */
class RedisHttpRateLimitStore implements RateLimitStore {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string
  ) {}

  async consume(key: string, _limit: number, windowMs: number, now: number): Promise<RateLimitBucket> {
    const redisKey = `hbm:rl:${key}`;
    const headers = {
      Authorization: `Bearer ${this.token}`,
      "Content-Type": "application/json"
    };

    const incrResponse = await fetch(`${this.baseUrl}/incr/${encodeURIComponent(redisKey)}`, {
      method: "POST",
      headers,
      signal: AbortSignal.timeout(2_000)
    });
    if (!incrResponse.ok) throw new Error(`Rate-limit Redis INCR failed: ${incrResponse.status}`);
    const count = Number(await incrResponse.json());

    if (count === 1) {
      await fetch(`${this.baseUrl}/pexpire/${encodeURIComponent(redisKey)}/${windowMs}`, {
        method: "POST",
        headers,
        signal: AbortSignal.timeout(2_000)
      });
    }

    const ttlResponse = await fetch(`${this.baseUrl}/pttl/${encodeURIComponent(redisKey)}`, {
      method: "POST",
      headers,
      signal: AbortSignal.timeout(2_000)
    });
    const ttlMs = Number(await ttlResponse.json());
    const resetAt = ttlMs > 0 ? now + ttlMs : now + windowMs;
    return { count, resetAt };
  }
}

const memoryStore = new MemoryRateLimitStore();
let activeStore: RateLimitStore = memoryStore;

export function resolveRateLimitStore(env: NodeJS.ProcessEnv = process.env): RateLimitStore {
  const redisUrl = env.HBM_RATE_LIMIT_REDIS_URL?.trim();
  const redisToken = env.HBM_RATE_LIMIT_REDIS_TOKEN?.trim();
  if (redisUrl?.startsWith("https://") && redisToken) {
    return new RedisHttpRateLimitStore(redisUrl.replace(/\/$/, ""), redisToken);
  }
  return memoryStore;
}

export function getRateLimitStore(): RateLimitStore {
  return activeStore;
}

/** Tests and bootstrapping can swap the store without restarting the process. */
export function setRateLimitStore(store: RateLimitStore): void {
  activeStore = store;
}

export function resetRateLimitStoreForTests(): void {
  memoryStore.clear();
  activeStore = memoryStore;
}
