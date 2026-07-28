import { NextResponse } from "next/server";
import { verifyPassword } from "@/src/auth/password";
import { createSession } from "@/src/auth/session";
import { prisma } from "@/src/db/client";
import { consumeRateLimit, rateLimitHeaders, requestClientKey } from "@/src/security/rateLimit";

const INVALID_CREDENTIALS = "Invalid email or password";

function invalidCredentialsResponse(headers?: HeadersInit) {
  return NextResponse.json({ error: INVALID_CREDENTIALS }, { status: 401, headers });
}

export async function POST(request: Request) {
  const clientKey = requestClientKey(request);
  const ipLimit = consumeRateLimit({
    key: `login-ip:${clientKey}`,
    limit: 20,
    windowMs: 15 * 60_000,
  });
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "Too many login attempts", code: "rate_limited" },
      { status: 429, headers: rateLimitHeaders(ipLimit) },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return invalidCredentialsResponse(rateLimitHeaders(ipLimit));
  }

  if (!body || typeof body !== "object") {
    return invalidCredentialsResponse(rateLimitHeaders(ipLimit));
  }

  const credentials = body as Record<string, unknown>;
  const email = typeof credentials.email === "string" ? credentials.email.trim().toLowerCase() : "";
  const password = typeof credentials.password === "string" ? credentials.password : "";
  const accountLimit = consumeRateLimit({
    key: `login-account:${email || "unknown"}`,
    limit: 5,
    windowMs: 15 * 60_000,
  });
  if (!accountLimit.allowed) {
    return NextResponse.json(
      { error: "Too many login attempts", code: "rate_limited" },
      { status: 429, headers: rateLimitHeaders(accountLimit) },
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return invalidCredentialsResponse(rateLimitHeaders(accountLimit));
  }

  // Only reported once the password checks out, so it cannot be used to probe
  // which addresses have accounts.
  if (!user.emailVerifiedAt) {
    return NextResponse.json(
      { error: "Verify your email address before signing in", code: "email_unverified" },
      { status: 403, headers: rateLimitHeaders(accountLimit) },
    );
  }

  const tokens = await createSession(user.id);
  // Web clients keep using the httpOnly cookie (set by createSession) and ignore the body tokens.
  // Native clients ignore the cookie and persist accessToken/refreshToken in SecureStore.
  return NextResponse.json(
    {
      ok: true,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      accessExpiresAt: tokens.accessExpiresAt.toISOString(),
      refreshExpiresAt: tokens.refreshExpiresAt.toISOString()
    },
    { headers: rateLimitHeaders(accountLimit) },
  );
}
