import { beforeEach, describe, expect, it } from "vitest";
import { consumeRateLimit, requestClientKey, resetRateLimitsForTests } from "@/src/security/rateLimit";

describe("rate limiting", () => {
  beforeEach(() => resetRateLimitsForTests());

  it("blocks requests after the configured limit and resets after the window", () => {
    expect(consumeRateLimit({ key: "login:test", limit: 2, windowMs: 1_000, now: 0 }).allowed).toBe(true);
    expect(consumeRateLimit({ key: "login:test", limit: 2, windowMs: 1_000, now: 100 }).allowed).toBe(true);
    expect(consumeRateLimit({ key: "login:test", limit: 2, windowMs: 1_000, now: 200 }).allowed).toBe(false);
    expect(consumeRateLimit({ key: "login:test", limit: 2, windowMs: 1_000, now: 1_000 }).allowed).toBe(true);
  });

  it("uses the first forwarded address", () => {
    const request = new Request("https://example.test", { headers: { "x-forwarded-for": "203.0.113.8, 10.0.0.2" } });
    expect(requestClientKey(request)).toBe("203.0.113.8");
  });
});
