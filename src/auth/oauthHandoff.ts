import { createHash, randomBytes } from "node:crypto";
import type { User } from "@prisma/client";
import { prisma } from "@/src/db/client";

const HANDOFF_KIND = "oauth_handoff";
const HANDOFF_TTL_MS = 5 * 60 * 1000;

export const OAUTH_HANDOFF_KIND = HANDOFF_KIND;
export const OAUTH_HANDOFF_TTL_MS = HANDOFF_TTL_MS;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Native clients authenticate with a Bearer header, but an OAuth login has to run
 * in a real browser that carries neither that header nor the web session cookie.
 * The app mints one of these, passes it in the start URL, and the start route
 * exchanges it for the user exactly once. Short TTL and single use keep the
 * window small, and the distinct session kind stops it being replayed as a
 * Bearer access token or a cookie session.
 */
export async function createOAuthHandoffToken(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");

  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      kind: HANDOFF_KIND,
      expiresAt: new Date(Date.now() + HANDOFF_TTL_MS)
    }
  });

  return token;
}

export async function consumeOAuthHandoffToken(token: string): Promise<User | null> {
  const candidate = token.trim();
  if (!candidate) return null;

  const tokenHash = hashToken(candidate);
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: true }
  });

  if (!session || session.kind !== HANDOFF_KIND) return null;

  // Single use: burn the token whether or not it turned out to be expired.
  await prisma.session.deleteMany({ where: { tokenHash } });

  if (session.expiresAt.getTime() <= Date.now()) return null;

  return session.user;
}
