import { createHash, randomBytes } from "node:crypto";
import { hashPassword } from "@/src/auth/password";
import { normalizeEmail } from "@/src/auth/registration";
import { prisma } from "@/src/db/client";
import { resolveAppBaseUrl, sendEmail } from "@/src/email/mailer";
import { passwordResetEmail } from "@/src/email/templates";

const TOKEN_TTL_MINUTES = 60;
const TOKEN_TTL_MS = TOKEN_TTL_MINUTES * 60 * 1000;

export type ResetPasswordResult = { ok: true } | { ok: false; reason: "invalid" | "expired" };

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function buildResetUrl(token: string): string {
  return `${resolveAppBaseUrl()}/reset-password?token=${encodeURIComponent(token)}`;
}

/**
 * Requests a reset link.
 *
 * Resolves the same way for a known and an unknown address, so this endpoint
 * cannot be used to discover who is registered — the same property
 * registration and resend already have.
 *
 * Every existing account gets a link, including legacy ones whose
 * emailVerifiedAt is null: that field no longer gates login, so withholding
 * the reset would strand those users with no way back in.
 */
export async function requestPasswordReset(rawEmail: string): Promise<void> {
  const email = normalizeEmail(rawEmail);
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) return;

  const token = randomBytes(32).toString("hex");

  // Replacing outstanding tokens means an older link cannot be used after the
  // user asks for a new one, which matters more here than for verification.
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, consumedAt: null } });
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS)
    }
  });

  await sendEmail(
    passwordResetEmail({ to: email, resetUrl: buildResetUrl(token), expiresInMinutes: TOKEN_TTL_MINUTES })
  );
}

/**
 * Consumes a reset link and sets the new password.
 *
 * Every existing session is dropped in the same transaction. A password reset is
 * the action someone takes when they think an account is compromised, so leaving
 * an attacker's phone signed in would defeat the point.
 */
export async function resetPassword(token: string, newPassword: string): Promise<ResetPasswordResult> {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) }
  });

  if (!record || record.consumedAt) return { ok: false, reason: "invalid" };

  if (record.expiresAt.getTime() <= Date.now()) {
    await prisma.passwordResetToken.delete({ where: { id: record.id } });
    return { ok: false, reason: "expired" };
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash: hashPassword(newPassword) }
    }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { consumedAt: now } }),
    prisma.session.deleteMany({ where: { userId: record.userId } })
  ]);

  return { ok: true };
}
