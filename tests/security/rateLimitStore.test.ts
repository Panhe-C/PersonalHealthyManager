import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  resolveRateLimitStore,
  resetRateLimitStoreForTests,
  setRateLimitStore
} from "@/src/security/rateLimitStore";
import { consumeRateLimitAsync } from "@/src/security/rateLimit";

function pipelineResponse(results: Array<{ result?: unknown; error?: string }>, init?: ResponseInit) {
  return new Response(JSON.stringify(results), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init
  });
}

describe("resolveRateLimitStore", () => {
  it("returns the Redis HTTP store for an https URL with a token", () => {
    const store = resolveRateLimitStore({
      HBM_RATE_LIMIT_REDIS_URL: "https://upstash.example.test/",
      HBM_RATE_LIMIT_REDIS_TOKEN: "secret"
    });
    expect(store.constructor.name).toBe("RedisHttpRateLimitStore");
  });

  it("falls back to the sync memory store with a warning for non-https URLs", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const store = resolveRateLimitStore({
      HBM_RATE_LIMIT_REDIS_URL: "redis://internal:6379",
      HBM_RATE_LIMIT_REDIS_TOKEN: "secret"
    });
    expect(store.consume("k", 1, 1_000, 0)).not.toBeInstanceOf(Promise);
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it("falls back to memory silently when Redis is not configured", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const store = resolveRateLimitStore({});
    expect(store.consume("k", 1, 1_000, 0)).not.toBeInstanceOf(Promise);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("RedisHttpRateLimitStore", () => {
  const env = {
    HBM_RATE_LIMIT_REDIS_URL: "https://upstash.example.test/",
    HBM_RATE_LIMIT_REDIS_TOKEN: "secret"
  };

  beforeEach(() => {
    setRateLimitStore(resolveRateLimitStore(env));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetRateLimitStoreForTests();
  });

  it("sends INCR + PEXPIRE(NX) + PTTL as a single pipeline request and parses results", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      pipelineResponse([{ result: 1 }, { result: 1 }, { result: 60_000 }])
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await consumeRateLimitAsync({ key: "login-ip:1.2.3.4", limit: 5, windowMs: 60_000, now: 1_000 });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://upstash.example.test/pipeline");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer secret");
    expect(JSON.parse(init.body as string)).toEqual([
      ["INCR", "hbm:rl:login-ip:1.2.3.4"],
      ["PEXPIRE", "hbm:rl:login-ip:1.2.3.4", 60_000, "NX"],
      ["PTTL", "hbm:rl:login-ip:1.2.3.4"]
    ]);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
    expect(result.resetAt).toBe(61_000);
  });

  it("sets the TTL only on the first request of a window via PEXPIRE NX", async () => {
    // Second request in the window: INCR returns 2 and PEXPIRE NX is a no-op (0),
    // while PTTL reports the remaining TTL of the existing key.
    const fetchMock = vi.fn().mockResolvedValue(
      pipelineResponse([{ result: 2 }, { result: 0 }, { result: 30_000 }])
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await consumeRateLimitAsync({ key: "k", limit: 5, windowMs: 60_000, now: 10_000 });

    expect(result.allowed).toBe(true);
    expect(result.resetAt).toBe(40_000);
  });

  it("rejects requests once INCR exceeds the limit (429 semantics)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      pipelineResponse([{ result: 3 }, { result: 0 }, { result: 45_000 }])
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await consumeRateLimitAsync({ key: "k", limit: 2, windowMs: 60_000, now: 5_000 });

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterSeconds).toBe(45);
  });

  it("falls back to the full window when PTTL reports no expiry", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      pipelineResponse([{ result: 1 }, { result: 1 }, { result: -1 }])
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await consumeRateLimitAsync({ key: "k", limit: 2, windowMs: 60_000, now: 5_000 });

    expect(result.resetAt).toBe(65_000);
  });

  it("throws when the pipeline request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(pipelineResponse([], { status: 500 })));

    await expect(
      consumeRateLimitAsync({ key: "k", limit: 2, windowMs: 60_000, now: 0 })
    ).rejects.toThrow("pipeline failed: 500");
  });

  it("throws when a pipelined command returns an error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(pipelineResponse([{ result: 1 }, { error: "ERR syntax error" }, { result: 1 }]))
    );

    await expect(
      consumeRateLimitAsync({ key: "k", limit: 2, windowMs: 60_000, now: 0 })
    ).rejects.toThrow("ERR syntax error");
  });
});
