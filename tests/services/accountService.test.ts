import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/src/auth/password", () => ({
  hashPassword: vi.fn(() => "new-hash"),
  verifyPassword: vi.fn()
}));

vi.mock("@/src/db/client", () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    session: { deleteMany: vi.fn() },
    $transaction: vi.fn()
  }
}));

import { hashPassword, verifyPassword } from "@/src/auth/password";
import { prisma } from "@/src/db/client";
import { changeUserPassword, getUserAccount } from "@/src/services/accountService";

describe("accountService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.user.update).mockReturnValue({ operation: "update" } as never);
    vi.mocked(prisma.session.deleteMany).mockReturnValue({ operation: "deleteSessions" } as never);
    vi.mocked(prisma.$transaction).mockResolvedValue([] as never);
  });

  it("loads the owner account without exposing the password hash", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      email: "owner@example.com",
      timezone: "Asia/Shanghai",
      createdAt: new Date("2026-07-18T00:00:00.000Z")
    } as never);

    await expect(getUserAccount("user-1")).resolves.toMatchObject({ email: "owner@example.com" });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: { id: true, email: true, timezone: true, createdAt: true }
    });
  });

  it("changes the password and revokes every existing session", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ passwordHash: "old-hash" } as never);
    vi.mocked(verifyPassword).mockImplementation((password) => password === "current-password");

    await changeUserPassword("user-1", "current-password", "new-password-123");

    expect(hashPassword).toHaveBeenCalledWith("new-password-123");
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: "user-1" }, data: { passwordHash: "new-hash" } });
    expect(prisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId: "user-1" } });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("rejects an incorrect current password", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ passwordHash: "old-hash" } as never);
    vi.mocked(verifyPassword).mockReturnValue(false);

    await expect(changeUserPassword("user-1", "wrong", "new-password-123")).rejects.toThrow("Invalid password");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
