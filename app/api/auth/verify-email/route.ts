import { NextResponse } from "next/server";
import { verifyEmailRequestSchema } from "@hbm/contracts";
import { verifyEmail } from "@/src/auth/registration";
import { consumeRateLimit, rateLimitHeaders, requestClientKey } from "@/src/security/rateLimit";

const FAILURES = {
  invalid: { error: "This verification link is not valid.", code: "invalid_token", status: 400 },
  expired: { error: "This verification link has expired. Request a new one.", code: "expired_token", status: 410 },
} as const;

export async function POST(request: Request) {
  const ipLimit = consumeRateLimit({
    key: `verify-email-ip:${requestClientKey(request)}`,
    limit: 30,
    windowMs: 15 * 60_000,
  });
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "Too many verification attempts", code: "rate_limited" },
      { status: 429, headers: rateLimitHeaders(ipLimit) },
    );
  }

  const parsed = verifyEmailRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: FAILURES.invalid.error, code: FAILURES.invalid.code },
      { status: FAILURES.invalid.status, headers: rateLimitHeaders(ipLimit) },
    );
  }

  const result = await verifyEmail(parsed.data.token);
  if (!result.ok) {
    const failure = FAILURES[result.reason];
    return NextResponse.json(
      { error: failure.error, code: failure.code },
      { status: failure.status, headers: rateLimitHeaders(ipLimit) },
    );
  }

  return NextResponse.json(
    { ok: true, alreadyVerified: result.alreadyVerified },
    { headers: rateLimitHeaders(ipLimit) },
  );
}
