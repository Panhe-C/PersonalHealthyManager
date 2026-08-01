import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/src/db/client", () => ({
  prisma: {
    user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    emailVerificationToken: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn()
    },
    $transaction: vi.fn(async (operations: unknown[]) => operations)
  }
}));

vi.mock("@/src/email/mailer", async () => {
  const actual = await vi.importActual<typeof import("@/src/email/mailer")>("@/src/email/mailer");
  return { ...actual, sendEmail: vi.fn(), resolveAppBaseUrl: () => "https://hbm.example.com" };
});

import { registerUser, resendVerification, verifyEmail } from "@/src/auth/registration";
import { prisma } from "@/src/db/client";
import { sendEmail } from "@/src/email/mailer";

const VALID_PASSWORD = "a-sufficiently-long-password";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function issuedToken(): string {
  const call = vi.mocked(prisma.emailVerificationToken.create).mock.calls[0]?.[0] as
    | { data: { tokenHash: string } }
    | undefined;
  return call?.data.tokenHash ?? "";
}

function lastEmail() {
  const calls = vi.mocked(sendEmail).mock.calls;
  return calls[calls.length - 1]?.[0];
}

describe("registerUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null as never);
    vi.mocked(prisma.user.create).mockResolvedValue({ id: "user-new" } as never);
    vi.mocked(prisma.emailVerificationToken.create).mockResolvedValue({} as never);
    vi.mocked(prisma.emailVerificationToken.deleteMany).mockResolvedValue({ count: 0 } as never);
  });

  it("creates an unverified account and emails a verification link", async () => {
    await registerUser({ email: "new@example.com", password: VALID_PASSWORD });

    const created = vi.mocked(prisma.user.create).mock.calls[0][0] as { data: Record<string, unknown> };
    expect(created.data.email).toBe("new@example.com");
    expect(created.data.passwordHash).not.toBe(VALID_PASSWORD);
    expect(created.data).not.toHaveProperty("emailVerifiedAt");

    const email = lastEmail();
    expect(email?.to).toBe("new@example.com");
    expect(email?.text).toContain("https://hbm.example.com/verify-email?token=");
  });

  it("stamps the terms acceptance time and version on a new account", async () => {
    await registerUser({ email: "new@example.com", password: VALID_PASSWORD });

    const created = vi.mocked(prisma.user.create).mock.calls[0][0] as { data: Record<string, unknown> };
    expect(created.data.termsAcceptedAt).toBeInstanceOf(Date);
    expect(created.data.termsAcceptedVersion).toBe("2026-08-01");
  });

  it("re-stamps the terms acceptance when an unverified account re-registers", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "user-1", emailVerifiedAt: null } as never);
    vi.mocked(prisma.user.update).mockResolvedValue({} as never);

    await registerUser({ email: "pending@example.com", password: VALID_PASSWORD });

    const updated = vi.mocked(prisma.user.update).mock.calls[0][0] as { data: Record<string, unknown> };
    expect(updated.data.termsAcceptedAt).toBeInstanceOf(Date);
    expect(updated.data.termsAcceptedVersion).toBe("2026-08-01");
  });

  it("does not touch terms acceptance for an already-verified account", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "user-1", emailVerifiedAt: new Date() } as never);

    await registerUser({ email: "taken@example.com", password: VALID_PASSWORD });

    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("stores only a hash of the verification token", async () => {
    await registerUser({ email: "new@example.com", password: VALID_PASSWORD });

    const link = lastEmail()?.text.match(/token=([a-f0-9]+)/)?.[1] ?? "";
    expect(link).not.toBe("");
    expect(issuedToken()).toBe(hashToken(link));
    expect(issuedToken()).not.toBe(link);
  });

  it("defaults the timezone but honours an explicit one", async () => {
    await registerUser({ email: "new@example.com", password: VALID_PASSWORD });
    expect((vi.mocked(prisma.user.create).mock.calls[0][0] as { data: { timezone: string } }).data.timezone).toBe(
      "Asia/Shanghai"
    );

    vi.clearAllMocks();
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null as never);
    vi.mocked(prisma.user.create).mockResolvedValue({ id: "user-new" } as never);
    await registerUser({ email: "new@example.com", password: VALID_PASSWORD, timezone: "Europe/Berlin" });
    expect((vi.mocked(prisma.user.create).mock.calls[0][0] as { data: { timezone: string } }).data.timezone).toBe(
      "Europe/Berlin"
    );
  });

  it("notifies the owner instead of creating a duplicate when the account is verified", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      emailVerifiedAt: new Date()
    } as never);

    await registerUser({ email: "taken@example.com", password: VALID_PASSWORD });

    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.emailVerificationToken.create).not.toHaveBeenCalled();
    expect(lastEmail()?.subject).toContain("already have");
  });

  it("re-sends verification and resets the password for an unverified account", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "user-1", emailVerifiedAt: null } as never);
    vi.mocked(prisma.user.update).mockResolvedValue({} as never);

    await registerUser({ email: "pending@example.com", password: VALID_PASSWORD });

    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.user.update).toHaveBeenCalled();
    expect(prisma.emailVerificationToken.create).toHaveBeenCalled();
    expect(lastEmail()?.subject).toContain("Verify");
  });

  it("invalidates outstanding tokens when a new one is issued", async () => {
    await registerUser({ email: "new@example.com", password: VALID_PASSWORD });

    expect(prisma.emailVerificationToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-new", consumedAt: null }
    });
  });
});

describe("verifyEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.$transaction).mockResolvedValue([] as never);
  });

  it("marks the account verified and consumes the token", async () => {
    vi.mocked(prisma.emailVerificationToken.findUnique).mockResolvedValue({
      id: "token-1",
      userId: "user-1",
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: { emailVerifiedAt: null }
    } as never);

    await expect(verifyEmail("raw-token")).resolves.toEqual({ ok: true, alreadyVerified: false });
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it("looks the token up by hash rather than by raw value", async () => {
    vi.mocked(prisma.emailVerificationToken.findUnique).mockResolvedValue(null as never);

    await verifyEmail("raw-token");

    expect(prisma.emailVerificationToken.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: hashToken("raw-token") },
      include: { user: true }
    });
  });

  it("rejects an unknown token", async () => {
    vi.mocked(prisma.emailVerificationToken.findUnique).mockResolvedValue(null as never);

    await expect(verifyEmail("nope")).resolves.toEqual({ ok: false, reason: "invalid" });
  });

  it("rejects and discards an expired token", async () => {
    vi.mocked(prisma.emailVerificationToken.findUnique).mockResolvedValue({
      id: "token-1",
      userId: "user-1",
      consumedAt: null,
      expiresAt: new Date(Date.now() - 60_000),
      user: { emailVerifiedAt: null }
    } as never);
    vi.mocked(prisma.emailVerificationToken.delete).mockResolvedValue({} as never);

    await expect(verifyEmail("stale")).resolves.toEqual({ ok: false, reason: "expired" });
    expect(prisma.emailVerificationToken.delete).toHaveBeenCalledWith({ where: { id: "token-1" } });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("treats a second click on a consumed link as success", async () => {
    vi.mocked(prisma.emailVerificationToken.findUnique).mockResolvedValue({
      id: "token-1",
      userId: "user-1",
      consumedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      user: { emailVerifiedAt: new Date() }
    } as never);

    await expect(verifyEmail("used")).resolves.toEqual({ ok: true, alreadyVerified: true });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("resendVerification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.emailVerificationToken.create).mockResolvedValue({} as never);
    vi.mocked(prisma.emailVerificationToken.deleteMany).mockResolvedValue({ count: 0 } as never);
  });

  it("sends a fresh link to an unverified account", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "user-1", emailVerifiedAt: null } as never);

    await resendVerification("Pending@Example.com");

    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: "pending@example.com" } });
    expect(lastEmail()?.to).toBe("pending@example.com");
  });

  it("stays silent for unknown and already-verified addresses", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null as never);
    await resendVerification("unknown@example.com");

    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "user-1", emailVerifiedAt: new Date() } as never);
    await resendVerification("verified@example.com");

    expect(sendEmail).not.toHaveBeenCalled();
  });
});
