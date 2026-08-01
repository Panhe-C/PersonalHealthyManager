import { NextResponse } from "next/server";
import { registerRequestSchema } from "@hbm/contracts";
import { normalizeEmail, registerUser } from "@/src/auth/registration";
import { captureError } from "@/src/observability/logger";
import { consumeRateLimit, rateLimitHeaders, requestClientKey } from "@/src/security/rateLimit";

export async function POST(request: Request) {
  const clientKey = requestClientKey(request);
  const ipLimit = consumeRateLimit({
    key: `register-ip:${clientKey}`,
    limit: 10,
    windowMs: 60 * 60_000,
  });
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "Too many registration attempts", code: "rate_limited" },
      { status: 429, headers: rateLimitHeaders(ipLimit) },
    );
  }

  const parsed = registerRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "A valid email, a password of 12 to 128 characters, and acceptance of the terms are required",
        code: "invalid_registration",
      },
      { status: 400, headers: rateLimitHeaders(ipLimit) },
    );
  }

  const email = normalizeEmail(parsed.data.email);
  const addressLimit = consumeRateLimit({
    key: `register-email:${email}`,
    limit: 5,
    windowMs: 60 * 60_000,
  });
  if (!addressLimit.allowed) {
    return NextResponse.json(
      { error: "Too many registration attempts", code: "rate_limited" },
      { status: 429, headers: rateLimitHeaders(addressLimit) },
    );
  }

  try {
    await registerUser({ email, password: parsed.data.password, timezone: parsed.data.timezone });
  } catch (error) {
    captureError("registration_failed", error);
    return NextResponse.json(
      { error: "Could not send the verification email. Try again later.", code: "verification_send_failed" },
      { status: 502, headers: rateLimitHeaders(addressLimit) },
    );
  }

  // Identical response whether or not the address was already registered, so
  // this endpoint cannot be used to discover which emails have accounts.
  return NextResponse.json(
    { ok: true, status: "verification_sent", email },
    { headers: rateLimitHeaders(addressLimit) },
  );
}
