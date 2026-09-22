import { afterEach, describe, expect, it, vi } from "vitest";
import {
  captureError,
  createRequestId,
  getRequestId,
  logger,
  redact,
  runWithRequestContext
} from "@/src/observability/logger";

describe("redact", () => {
  it("scrubs sensitive keys and emails nested in objects", () => {
    const result = redact({
      email: "owner@example.test",
      password: "secret-password",
      apiKey: "sk-live-abcdef",
      note: "write to owner@example.test please",
      nested: { authorization: "Bearer abc.def.ghi", ok: true }
    }) as Record<string, unknown>;

    expect(result.email).toBe("[redacted]");
    expect(result.password).toBe("[redacted]");
    expect(result.apiKey).toBe("[redacted]");
    expect(result.note).toBe("write to [email] please");
    expect((result.nested as Record<string, unknown>).authorization).toBe("[redacted]");
    expect((result.nested as Record<string, unknown>).ok).toBe(true);
  });

  it("scrubs long hex tokens in free text", () => {
    expect(redact(`token=${"a".repeat(40)}`)).toBe("token=[token]");
  });

  it("scrubs snake_case OAuth-style keys after normalization", () => {
    const result = redact({
      access_token: "oauth-access-token",
      refresh_token: "oauth-refresh-token",
      client_secret: "oauth-client-secret",
      api_key: "sk-live-abcdef",
      emails: ["owner@example.test"],
      messages: ["hello"],
      expires_in: 3600
    }) as Record<string, unknown>;

    expect(result.access_token).toBe("[redacted]");
    expect(result.refresh_token).toBe("[redacted]");
    expect(result.client_secret).toBe("[redacted]");
    expect(result.api_key).toBe("[redacted]");
    expect(result.emails).toBe("[redacted]");
    expect(result.messages).toBe("[redacted]");
    expect(result.expires_in).toBe(3600);
  });
});

describe("request context", () => {
  it("exposes the request id inside the async scope", () => {
    const id = createRequestId();
    runWithRequestContext({ requestId: id }, () => {
      expect(getRequestId()).toBe(id);
    });
    expect(getRequestId()).toBeUndefined();
  });
});

describe("logger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.HBM_ERROR_WEBHOOK_URL;
  });

  it("writes JSON lines and never includes a raw email", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    captureError("test_failure", new Error("boom for owner@example.test"), {
      email: "owner@example.test",
      password: "x"
    });

    expect(spy).toHaveBeenCalledOnce();
    const line = spy.mock.calls[0][0] as string;
    expect(line).not.toContain("owner@example.test");
    expect(line).toContain("test_failure");
    expect(line).toContain("[redacted]");
  });

  it("forwards errors to the optional webhook when configured", async () => {
    process.env.HBM_ERROR_WEBHOOK_URL = "https://hooks.example.test/errors";
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});

    logger.error("sink_test", { code: "x" });
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(fetchMock).toHaveBeenCalledWith(
      "https://hooks.example.test/errors",
      expect.objectContaining({ method: "POST" })
    );
  });
});
