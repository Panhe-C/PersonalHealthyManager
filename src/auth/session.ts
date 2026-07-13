import { createHash, randomBytes } from "node:crypto";
import type { User } from "@prisma/client";
import { cookies, headers } from "next/headers";
import { prisma } from "@/src/db/client";

const COOKIE_NAME = "hbm_session";
const SESSION_DAYS = 30;
const REFRESH_DURATION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;
const ACCESS_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export const ACCESS_TOKEN_TTL_MS = ACCESS_DURATION_MS;

type SessionKind = "access" | "refresh";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: Date;
  refreshExpiresAt: Date;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function createToken(
  userId: string,
  kind: SessionKind,
  ttlMs: number,
  parentId?: string
): Promise<{ token: string; expiresAt: Date; tokenHash: string }> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + ttlMs);
  const tokenHash = hashToken(token);

  await prisma.session.create({
    data: {
      userId,
      tokenHash,
      kind,
      parentId: kind === "access" ? parentId ?? null : null,
      expiresAt
    }
  });

  return { token, expiresAt, tokenHash };
}

async function deleteSessionByHash(tokenHash: string): Promise<void> {
  // Cascade: deleting a refresh token also invalidates its access children.
  await prisma.session.deleteMany({
    where: { OR: [{ tokenHash }, { parentId: tokenHash }] }
  });
}

/**
 * Issue a refresh + access token pair for a user. The refresh token is also
 * written into the httpOnly cookie so the existing Web flow keeps working
 * unchanged. Returns the pair so callers (e.g. login) can surface it in the
 * response body for native clients.
 */
export async function createSession(userId: string): Promise<TokenPair> {
  const refresh = await createToken(userId, "refresh", REFRESH_DURATION_MS);
  const access = await createToken(userId, "access", ACCESS_DURATION_MS, refresh.tokenHash);

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, refresh.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: refresh.expiresAt,
    path: "/"
  });

  return {
    accessToken: access.token,
    refreshToken: refresh.token,
    accessExpiresAt: access.expiresAt,
    refreshExpiresAt: refresh.expiresAt
  };
}

export async function getUserByBearer(token: string): Promise<User | null> {
  const tokenHash = hashToken(token);
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: true }
  });

  if (!session || session.kind !== "access") {
    return null;
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.deleteMany({ where: { tokenHash } });
    return null;
  }

  return session.user;
}

async function getUserByCookie(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const tokenHash = hashToken(token);
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: true }
  });

  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.deleteMany({ where: { tokenHash } });
    return null;
  }

  return session.user;
}

/**
 * Dual-channel current user resolution. Bearer token (native App) takes
 * priority over the Web cookie session, so `withUser` needs no changes to
 * support both clients.
 */
export async function getCurrentUser(): Promise<User | null> {
  const headerStore = await headers();
  const authorization = headerStore.get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);

  if (match) {
    return getUserByBearer(match[1]);
  }

  return getUserByCookie();
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

/**
 * Rotate a refresh token: invalidates the old refresh + its access children,
 * issues a fresh pair. Native clients persist the new tokens. Web never calls
 * this (it uses the cookie directly), so no cookie update is needed here.
 */
export async function refreshSession(refreshToken: string): Promise<TokenPair | null> {
  const refreshHash = hashToken(refreshToken);
  const session = await prisma.session.findUnique({
    where: { tokenHash: refreshHash },
    include: { user: true }
  });

  if (!session || session.kind !== "refresh") return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    await deleteSessionByHash(refreshHash);
    return null;
  }

  await deleteSessionByHash(refreshHash);

  const newRefresh = await createToken(session.userId, "refresh", REFRESH_DURATION_MS);
  const newAccess = await createToken(session.userId, "access", ACCESS_DURATION_MS, newRefresh.tokenHash);

  return {
    accessToken: newAccess.token,
    refreshToken: newRefresh.token,
    accessExpiresAt: newAccess.expiresAt,
    refreshExpiresAt: newRefresh.expiresAt
  };
}

/** Web logout: invalidate the cookie session (refresh + access children). */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) {
    await deleteSessionByHash(hashToken(token));
  }
  cookieStore.delete(COOKIE_NAME);
}

/** Native logout: invalidate by refresh token. */
export async function destroyBearerSession(refreshToken: string): Promise<void> {
  await deleteSessionByHash(hashToken(refreshToken));
}
