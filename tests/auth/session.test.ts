import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

const { cookieStore, headerMap, sessionCreate, sessionFindUnique, sessionDeleteMany } = vi.hoisted(() => ({
  cookieStore: new Map<string, string>(),
  headerMap: new Map<string, string>(),
  sessionCreate: vi.fn(),
  sessionFindUnique: vi.fn(),
  sessionDeleteMany: vi.fn()
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => (cookieStore.has(name) ? { value: cookieStore.get(name) } : undefined),
    set: (name: string, value: string) => cookieStore.set(name, value),
    delete: (name: string) => cookieStore.delete(name)
  })),
  headers: vi.fn(async () => ({
    get: (name: string) => headerMap.get(name.toLowerCase())
  }))
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

import {
  createSession,
  getCurrentUser,
  getUserByBearer,
  refreshSession,
  destroyBearerSession,
  destroySession
} from "@/src/auth/session";

function fakeUser() {
  return { id: "user-1", email: "demo@example.com", passwordHash: "h", timezone: "Asia/Shanghai", createdAt: new Date(), updatedAt: new Date() };
}

beforeEach(() => {
  cookieStore.clear();
  headerMap.clear();
  sessionCreate.mockReset();
  sessionFindUnique.mockReset();
  sessionDeleteMany.mockReset();
  // Default: create just records the row.
  sessionCreate.mockImplementation(async (args: { data: { tokenHash: string; kind: string; parentId: string | null } }) => args.data);
});

describe("createSession issues a refresh + access pair and writes cookie", () => {
  it("sets the hbm_session cookie with the refresh token and returns both tokens", async () => {
    const pair = await createSession("user-1");

    expect(pair.accessToken).toBeTruthy();
    expect(pair.refreshToken).toBeTruthy();
    expect(pair.accessToken).not.toBe(pair.refreshToken);
    expect(cookieStore.get("hbm_session")).toBe(pair.refreshToken);
    // Two rows: one refresh, one access whose parentId is the refresh hash.
    expect(sessionCreate).toHaveBeenCalledTimes(2);
    const refreshCall = sessionCreate.mock.calls[0][0].data;
    const accessCall = sessionCreate.mock.calls[1][0].data;
    expect(refreshCall.kind).toBe("refresh");
    expect(accessCall.kind).toBe("access");
    expect(accessCall.parentId).toBe(refreshCall.tokenHash);
  });
});

describe("getUserByBearer", () => {
  it("returns the user for a valid access token", async () => {
    sessionFindUnique.mockResolvedValue({ kind: "access", expiresAt: new Date(Date.now() + 60000), user: fakeUser() });

    const user = await getUserByBearer("some-access-token");

    expect(user?.id).toBe("user-1");
  });

  it("returns null and deletes an expired access token", async () => {
    sessionFindUnique.mockResolvedValue({ kind: "access", expiresAt: new Date(Date.now() - 1000), user: fakeUser() });

    const user = await getUserByBearer("expired");

    expect(user).toBeNull();
    expect(sessionDeleteMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tokenHash: expect.any(String) } }));
  });

  it("returns null when the token is a refresh token, not access", async () => {
    sessionFindUnique.mockResolvedValue({ kind: "refresh", expiresAt: new Date(Date.now() + 60000), user: fakeUser() });

    const user = await getUserByBearer("a-refresh-token");

    expect(user).toBeNull();
  });
});

describe("getCurrentUser dual-channel", () => {
  it("prefers Bearer header over cookie", async () => {
    cookieStore.set("hbm_session", "cookie-refresh-token");
    headerMap.set("authorization", "Bearer access-token");
    const bearerUser = { ...fakeUser(), id: "bearer-user" };
    const cookieUser = { ...fakeUser(), id: "cookie-user" };
    const bearerHash = hash("access-token");
    const cookieHash = hash("cookie-refresh-token");

    sessionFindUnique.mockImplementation(async (args: { where: { tokenHash: string } }) => {
      if (args.where.tokenHash === bearerHash) {
        return { kind: "access", expiresAt: new Date(Date.now() + 60000), user: bearerUser };
      }
      if (args.where.tokenHash === cookieHash) {
        return { kind: "refresh", expiresAt: new Date(Date.now() + 60000), user: cookieUser };
      }
      return null;
    });

    const user = await getCurrentUser();

    expect(user?.id).toBe("bearer-user");
    // Bearer path was taken: findUnique called exactly once (no cookie fallback).
    expect(sessionFindUnique).toHaveBeenCalledTimes(1);
    expect(sessionFindUnique).toHaveBeenCalledWith({ where: { tokenHash: bearerHash }, include: { user: true } });
  });

  it("falls back to cookie when no Bearer header is present", async () => {
    cookieStore.set("hbm_session", "cookie-refresh-token");
    sessionFindUnique.mockResolvedValue({ kind: "refresh", expiresAt: new Date(Date.now() + 60000), user: fakeUser() });

    const user = await getCurrentUser();

    expect(user?.id).toBe("user-1");
  });
});

describe("refreshSession rotates tokens and cascades deletion", () => {
  it("deletes the old refresh + issues a new pair", async () => {
    sessionFindUnique.mockResolvedValue({
      kind: "refresh",
      expiresAt: new Date(Date.now() + 60000),
      user: fakeUser()
    });

    const pair = await refreshSession("old-refresh");

    expect(pair).not.toBeNull();
    expect(pair?.accessToken).toBeTruthy();
    expect(pair?.refreshToken).not.toBe("old-refresh");
    // deleteMany called once for the old refresh + its access children.
    expect(sessionDeleteMany).toHaveBeenCalledTimes(1);
    expect(sessionDeleteMany.mock.calls[0][0].where.OR).toEqual([
      { tokenHash: expect.any(String) },
      { parentId: expect.any(String) }
    ]);
    // New pair created.
    expect(sessionCreate).toHaveBeenCalledTimes(2);
  });

  it("returns null and cascades deletion for an expired refresh", async () => {
    sessionFindUnique.mockResolvedValue({
      kind: "refresh",
      expiresAt: new Date(Date.now() - 1000),
      user: fakeUser()
    });

    const pair = await refreshSession("expired-refresh");

    expect(pair).toBeNull();
    expect(sessionDeleteMany).toHaveBeenCalled();
  });

  it("returns null when the token is not a refresh token", async () => {
    sessionFindUnique.mockResolvedValue({
      kind: "access",
      expiresAt: new Date(Date.now() + 60000),
      user: fakeUser()
    });

    const pair = await refreshSession("an-access-token");

    expect(pair).toBeNull();
  });
});

describe("destroyBearerSession cascades", () => {
  it("deletes the refresh token and its access children", async () => {
    await destroyBearerSession("refresh-token");

    expect(sessionDeleteMany).toHaveBeenCalledWith({
      where: { OR: [{ tokenHash: expect.any(String) }, { parentId: expect.any(String) }] }
    });
  });
});

describe("destroySession (cookie)", () => {
  it("deletes by cookie value and clears the cookie", async () => {
    cookieStore.set("hbm_session", "cookie-token");

    await destroySession();

    expect(sessionDeleteMany).toHaveBeenCalledWith({
      where: { OR: [{ tokenHash: expect.any(String) }, { parentId: expect.any(String) }] }
    });
    expect(cookieStore.has("hbm_session")).toBe(false);
  });
});
