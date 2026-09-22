import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

const { sessionCreate, sessionFindUnique, sessionDeleteMany } = vi.hoisted(() => ({
  sessionCreate: vi.fn(),
  sessionFindUnique: vi.fn(),
  sessionDeleteMany: vi.fn()
}));

vi.mock("@/src/db/client", () => ({
  prisma: {
    session: {
      create: sessionCreate,
      findUnique: sessionFindUnique,
      deleteMany: sessionDeleteMany
    }
  }
}));

import { consumeOAuthHandoffToken, createOAuthHandoffToken, OAUTH_HANDOFF_KIND } from "@/src/auth/oauthHandoff";

function fakeUser() {
  return { id: "user-1", email: "demo@example.com" };
}

beforeEach(() => {
  sessionCreate.mockReset();
  sessionFindUnique.mockReset();
  sessionDeleteMany.mockReset();
  sessionCreate.mockImplementation(async (args: { data: unknown }) => args.data);
});

describe("createOAuthHandoffToken", () => {
  it("stores only the hash under a dedicated session kind", async () => {
    const token = await createOAuthHandoffToken("user-1");

    expect(token).toMatch(/^[a-f0-9]{64}$/);
    const created = sessionCreate.mock.calls[0][0].data;
    expect(created.tokenHash).toBe(hash(token));
    expect(created.kind).toBe(OAUTH_HANDOFF_KIND);
    expect(created.userId).toBe("user-1");
    // The raw token must never be persisted.
    expect(JSON.stringify(created)).not.toContain(token);
  });

  it("expires within a few minutes rather than lasting like a session", async () => {
    await createOAuthHandoffToken("user-1");

    const { expiresAt } = sessionCreate.mock.calls[0][0].data;
    const ttlMs = expiresAt.getTime() - Date.now();
    expect(ttlMs).toBeGreaterThan(0);
    expect(ttlMs).toBeLessThanOrEqual(5 * 60 * 1000);
  });
});

describe("consumeOAuthHandoffToken", () => {
  it("returns the user and burns the token so it cannot be replayed", async () => {
    sessionFindUnique.mockResolvedValue({
      kind: OAUTH_HANDOFF_KIND,
      expiresAt: new Date(Date.now() + 60_000),
      user: fakeUser()
    });

    const user = await consumeOAuthHandoffToken("token-1");

    expect(user?.id).toBe("user-1");
    expect(sessionDeleteMany).toHaveBeenCalledWith({ where: { tokenHash: hash("token-1") } });
  });

  it("rejects an expired token but still burns it", async () => {
    sessionFindUnique.mockResolvedValue({
      kind: OAUTH_HANDOFF_KIND,
      expiresAt: new Date(Date.now() - 1),
      user: fakeUser()
    });

    expect(await consumeOAuthHandoffToken("token-1")).toBeNull();
    expect(sessionDeleteMany).toHaveBeenCalled();
  });

  it("refuses tokens of another session kind", async () => {
    sessionFindUnique.mockResolvedValue({
      kind: "access",
      expiresAt: new Date(Date.now() + 60_000),
      user: fakeUser()
    });

    expect(await consumeOAuthHandoffToken("token-1")).toBeNull();
    // An access token must not be consumed as a side effect of being offered here.
    expect(sessionDeleteMany).not.toHaveBeenCalled();
  });

  it("rejects an unknown or blank token", async () => {
    sessionFindUnique.mockResolvedValue(null);
    expect(await consumeOAuthHandoffToken("nope")).toBeNull();

    expect(await consumeOAuthHandoffToken("   ")).toBeNull();
    expect(sessionFindUnique).toHaveBeenCalledTimes(1);
  });
});
