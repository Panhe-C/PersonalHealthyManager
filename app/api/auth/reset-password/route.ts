import { NextResponse } from "next/server";
import { resetPasswordRequestSchema } from "@hbm/contracts";
import { resetPassword } from "@/src/auth/passwordReset";
import { consumeRateLimitAsync, rateLimitHeaders, requestClientKey } from "@/src/security/rateLimit";

const FAILURES = {
  invalid: { error: "This reset link is not valid.", code: "invalid_token", status: 400 },
  expired: { error: "This reset link has expired. Request a new one.", code: "expired_token", status: 410 },
} as const;

export async function POST(request: Request) {
  const ipLimit = await consumeRateLimitAsync({
    key: `reset-password-ip:${requestClientKey(request)}`,
    limit: 30,
    windowMs: 15 * 60_000,
  });
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "Too many reset attempts", code: "rate_limited" },
      { status: 429, headers: rateLimitHeaders(ipLimit) },
    );
  }

  const parsed = resetPasswordRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    // A password that fails the policy is reported separately from a bad link so
    // the form can point at the field the user can actually fix.
    const weakPassword = parsed.error.issues.some((issue) => issue.path[0] === "password");
    return weakPassword
      ? NextResponse.json(
          { error: "Use at least 12 characters.", code: "weak_password" },
          { status: 400, headers: rateLimitHeaders(ipLimit) },
        )
      : NextResponse.json(
          { error: FAILURES.invalid.error, code: FAILURES.invalid.code },
          { status: FAILURES.invalid.status, headers: rateLimitHeaders(ipLimit) },
        );
  }

  const result = await resetPassword(parsed.data.token, parsed.data.password);
  if (!result.ok) {
    const failure = FAILURES[result.reason];
    return NextResponse.json(
      { error: failure.error, code: failure.code },
      { status: failure.status, headers: rateLimitHeaders(ipLimit) },
    );
  }

  return NextResponse.json({ ok: true }, { headers: rateLimitHeaders(ipLimit) });
}
