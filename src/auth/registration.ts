import { createHash, randomBytes } from "node:crypto";
import { CURRENT_TERMS_VERSION } from "@hbm/contracts";
import { hashPassword } from "@/src/auth/password";
import { prisma } from "@/src/db/client";
import { resolveAppBaseUrl, sendEmail } from "@/src/email/mailer";
import { verificationEmail } from "@/src/email/templates";

const TOKEN_TTL_HOURS = 24;
const TOKEN_TTL_MS = TOKEN_TTL_HOURS * 60 * 60 * 1000;
const DEFAULT_TIMEZONE = "Asia/Shanghai";

export type VerifyEmailResult =
  | { ok: true; alreadyVerified: boolean }
  | { ok: false; reason: "invalid" | "expired" };

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function buildVerifyUrl(token: string): string {
  return `${resolveAppBaseUrl()}/verify-email?token=${encodeURIComponent(token)}`;
}

/**
 * Replaces any outstanding tokens for the user so an older link in a forwarded
 * inbox cannot be replayed after a resend.
 */
async function issueVerificationToken(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");

  await prisma.emailVerificationToken.deleteMany({ where: { userId, consumedAt: null } });
  await prisma.emailVerificationToken.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS)
    }
  });

  return token;
}

async function sendVerification(email: string, userId: string): Promise<void> {
  const token = await issueVerificationToken(userId);
  await sendEmail(verificationEmail({ to: email, verifyUrl: buildVerifyUrl(token), expiresInHours: TOKEN_TTL_HOURS }));
}

/**
 * Creates an immediately usable account without requiring email delivery.
 *
 * Callers get no signal about whether the address was already taken: an
 * Existing pending accounts are promoted to usable accounts when they
 * re-register. Existing usable accounts remain unchanged. All paths resolve
 * the same way so the public endpoint does not enumerate registered addresses.
 */
export async function registerUser(input: {
  email: string;
  password: string;
  timezone?: string;
}): Promise<void> {
  const email = normalizeEmail(input.email);
  const timezone = input.timezone?.trim() || DEFAULT_TIMEZONE;
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    if (existing.emailVerifiedAt) {
      return;
    }

    // Unverified accounts have never been usable, so letting a repeat signup
    // reset the password avoids stranding someone who mistyped it initially.
    // Re-accepting terms here records the version the user actually saw.
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        passwordHash: hashPassword(input.password),
        timezone,
        emailVerifiedAt: new Date(),
        termsAcceptedAt: new Date(),
        termsAcceptedVersion: CURRENT_TERMS_VERSION
      }
    });
    return;
  }

  await prisma.user.create({
    data: {
      email,
      passwordHash: hashPassword(input.password),
      timezone,
      emailVerifiedAt: new Date(),
      termsAcceptedAt: new Date(),
      termsAcceptedVersion: CURRENT_TERMS_VERSION
    }
  });
}

export async function verifyEmail(token: string): Promise<VerifyEmailResult> {
  const record = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true }
  });

  if (!record) return { ok: false, reason: "invalid" };

  if (record.consumedAt) {
    // A second click on the same link is a success from the user's point of
    // view as long as the account did end up verified.
    return record.user.emailVerifiedAt ? { ok: true, alreadyVerified: true } : { ok: false, reason: "invalid" };
  }

  if (record.expiresAt.getTime() <= Date.now()) {
    await prisma.emailVerificationToken.delete({ where: { id: record.id } });
    return { ok: false, reason: "expired" };
  }

  if (record.user.emailVerifiedAt) {
    await prisma.emailVerificationToken.update({
      where: { id: record.id },
      data: { consumedAt: new Date() }
    });
    return { ok: true, alreadyVerified: true };
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: now } }),
    prisma.emailVerificationToken.update({ where: { id: record.id }, data: { consumedAt: now } })
  ]);

  return { ok: true, alreadyVerified: false };
}

/**
 * Re-sends a verification link. Like registration, this resolves identically
 * whether or not the address exists.
 */
export async function resendVerification(rawEmail: string): Promise<void> {
  const email = normalizeEmail(rawEmail);
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || user.emailVerifiedAt) return;

  await sendVerification(email, user.id);
}
