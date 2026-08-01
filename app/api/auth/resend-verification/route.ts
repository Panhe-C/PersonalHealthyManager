import { NextResponse } from "next/server";
import { resendVerificationRequestSchema } from "@hbm/contracts";
import { normalizeEmail, resendVerification } from "@/src/auth/registration";
import { captureError } from "@/src/observability/logger";
import { consumeRateLimit, rateLimitHeaders, requestClientKey } from "@/src/security/rateLimit";

export async function POST(request: Request) {
  const ipLimit = consumeRateLimit({
    key: `resend-verification-ip:${requestClientKey(request)}`,
    limit: 10,
    windowMs: 60 * 60_000,
  });
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests", code: "rate_limited" },
      { status: 429, headers: rateLimitHeaders(ipLimit) },
    );
  }

  const parsed = resendVerificationRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "A valid email address is required", code: "invalid_email" },
      { status: 400, headers: rateLimitHeaders(ipLimit) },
    );
  }

  const email = normalizeEmail(parsed.data.email);
  const addressLimit = consumeRateLimit({
    key: `resend-verification-email:${email}`,
    limit: 3,
    windowMs: 60 * 60_000,
  });
  if (!addressLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests", code: "rate_limited" },
      { status: 429, headers: rateLimitHeaders(addressLimit) },
    );
  }

  try {
    await resendVerification(email);
  } catch (error) {
    captureError("resend_verification_failed", error);
    return NextResponse.json(
      { error: "Could not send the verification email. Try again later.", code: "verification_send_failed" },
      { status: 502, headers: rateLimitHeaders(addressLimit) },
    );
  }

  // Same response for unknown, unverified, and already-verified addresses.
  return NextResponse.json(
    { ok: true, status: "verification_sent", email },
    { headers: rateLimitHeaders(addressLimit) },
  );
}
