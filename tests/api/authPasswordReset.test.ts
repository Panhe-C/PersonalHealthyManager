import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/src/db/client", () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    passwordResetToken: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn()
    },
    session: { deleteMany: vi.fn() },
    $transaction: vi.fn(async (operations: unknown[]) => operations)
  }
}));

vi.mock("@/src/email/mailer", async () => {
  const actual = await vi.importActual<typeof import("@/src/email/mailer")>("@/src/email/mailer");
  return { ...actual, sendEmail: vi.fn(), resolveAppBaseUrl: () => "https://hbm.example.com" };
});

import { requestPasswordReset, resetPassword } from "@/src/auth/passwordReset";
import { verifyPassword } from "@/src/auth/password";
import { prisma } from "@/src/db/client";
import { sendEmail } from "@/src/email/mailer";

const NEW_PASSWORD = "a-sufficiently-long-password";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function lastEmail() {
  const calls = vi.mocked(sendEmail).mock.calls;
  return calls[calls.length - 1]?.[0];
}

describe("requestPasswordReset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.passwordResetToken.create).mockResolvedValue({} as never);
    vi.mocked(prisma.passwordResetToken.deleteMany).mockResolvedValue({ count: 0 } as never);
  });

  it("emails a reset link to a verified account", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "user-1", emailVerifiedAt: new Date() } as never);

    await requestPasswordReset("Owner@Example.com");

    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: "owner@example.com" } });
    expect(lastEmail()?.to).toBe("owner@example.com");
    expect(lastEmail()?.text).toContain("https://hbm.example.com/reset-password?token=");
  });

  it("stores only a hash of the token", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "user-1", emailVerifiedAt: new Date() } as never);

    await requestPasswordReset("owner@example.com");

    const rawToken = lastEmail()?.text.match(/token=([a-f0-9]+)/)?.[1] ?? "";
    const stored = (vi.mocked(prisma.passwordResetToken.create).mock.calls[0][0] as { data: { tokenHash: string } })
      .data.tokenHash;
    expect(rawToken).not.toBe("");
    expect(stored).toBe(hashToken(rawToken));
    expect(stored).not.toBe(rawToken);
  });

  it("expires the link in an hour rather than a day", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "user-1", emailVerifiedAt: new Date() } as never);

    await requestPasswordReset("owner@example.com");

    const { expiresAt } = (vi.mocked(prisma.passwordResetToken.create).mock.calls[0][0] as {
      data: { expiresAt: Date };
    }).data;
    const minutes = Math.round((expiresAt.getTime() - Date.now()) / 60_000);
    expect(minutes).toBe(60);
  });

  it("invalidates outstanding links when a new one is issued", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "user-1", emailVerifiedAt: new Date() } as never);

    await requestPasswordReset("owner@example.com");

    expect(prisma.passwordResetToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1", consumedAt: null }
    });
  });

  it("stays silent for an unknown address so the endpoint cannot enumerate accounts", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null as never);

    await requestPasswordReset("stranger@example.com");

    expect(sendEmail).not.toHaveBeenCalled();
    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
  });

  it("refuses to reset an unverified account, which would bypass verification", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "user-1", emailVerifiedAt: null } as never);

    await requestPasswordReset("pending@example.com");

    expect(sendEmail).not.toHaveBeenCalled();
    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
  });
});

describe("resetPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.$transaction).mockResolvedValue([] as never);
  });

  it("stores a hash of the new password and consumes the token", async () => {
    vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue({
      id: "token-1",
      userId: "user-1",
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60_000)
    } as never);

    await expect(resetPassword("raw-token", NEW_PASSWORD)).resolves.toEqual({ ok: true });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { passwordHash: expect.any(String) }
    });
    const { passwordHash } = vi.mocked(prisma.user.update).mock.calls[0][0].data as { passwordHash: string };
    expect(passwordHash).not.toBe(NEW_PASSWORD);
    expect(verifyPassword(NEW_PASSWORD, passwordHash)).toBe(true);
    expect(prisma.passwordResetToken.update).toHaveBeenCalledWith({
      where: { id: "token-1" },
      data: { consumedAt: expect.any(Date) }
    });
  });

  it("signs every existing device out in the same transaction", async () => {
    vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue({
      id: "token-1",
      userId: "user-1",
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60_000)
    } as never);

    await resetPassword("raw-token", NEW_PASSWORD);

    expect(prisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId: "user-1" } });
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it("looks the token up by hash rather than by raw value", async () => {
    vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue(null as never);

    await resetPassword("raw-token", NEW_PASSWORD);

    expect(prisma.passwordResetToken.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: hashToken("raw-token") }
    });
  });

  it("rejects an unknown token", async () => {
    vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue(null as never);

    await expect(resetPassword("nope", NEW_PASSWORD)).resolves.toEqual({ ok: false, reason: "invalid" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects a token that was already used", async () => {
    vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue({
      id: "token-1",
      userId: "user-1",
      consumedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000)
    } as never);

    await expect(resetPassword("used", NEW_PASSWORD)).resolves.toEqual({ ok: false, reason: "invalid" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects and discards an expired token", async () => {
    vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue({
      id: "token-1",
      userId: "user-1",
      consumedAt: null,
      expiresAt: new Date(Date.now() - 60_000)
    } as never);
    vi.mocked(prisma.passwordResetToken.delete).mockResolvedValue({} as never);

    await expect(resetPassword("stale", NEW_PASSWORD)).resolves.toEqual({ ok: false, reason: "expired" });
    expect(prisma.passwordResetToken.delete).toHaveBeenCalledWith({ where: { id: "token-1" } });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
