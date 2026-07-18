import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/src/auth/api", () => ({
  withUser:
    (handler: (...args: unknown[]) => Promise<Response>) =>
    (request: Request) =>
      handler({ id: "user-1", timezone: "Asia/Shanghai" }, request)
}));

const { changeUserPassword, deleteUserAccount, getUserAccount } = vi.hoisted(() => ({
  changeUserPassword: vi.fn(),
  deleteUserAccount: vi.fn(),
  getUserAccount: vi.fn()
}));

vi.mock("@/src/services/accountService", () => ({ changeUserPassword, deleteUserAccount, getUserAccount }));

import { DELETE, GET, PATCH } from "@/app/api/v1/account/route";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DELETE /api/v1/account", () => {
  it("returns 400 when password is missing", async () => {
    const response = await DELETE(
      new Request("http://localhost/api/v1/account", { method: "DELETE", body: JSON.stringify({}) })
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "password_required" });
    expect(deleteUserAccount).not.toHaveBeenCalled();
  });

  it("deletes the account and returns ok", async () => {
    deleteUserAccount.mockResolvedValue(undefined);
    const response = await DELETE(
      new Request("http://localhost/api/v1/account", { method: "DELETE", body: JSON.stringify({ password: "secret" }) })
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(deleteUserAccount).toHaveBeenCalledWith("user-1", "secret");
  });

  it("returns 401 when the password is wrong", async () => {
    deleteUserAccount.mockRejectedValue(new Error("Invalid password"));
    const response = await DELETE(
      new Request("http://localhost/api/v1/account", { method: "DELETE", body: JSON.stringify({ password: "wrong" }) })
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "invalid_password" });
  });
});

describe("GET /api/v1/account", () => {
  it("returns the authenticated owner's account", async () => {
    getUserAccount.mockResolvedValue({
      id: "user-1",
      email: "owner@example.com",
      timezone: "Asia/Shanghai",
      createdAt: new Date("2026-07-18T00:00:00.000Z")
    });

    const response = await GET(new Request("http://localhost/api/v1/account"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: "user-1",
      email: "owner@example.com",
      timezone: "Asia/Shanghai",
      createdAt: "2026-07-18T00:00:00.000Z"
    });
  });
});

describe("PATCH /api/v1/account", () => {
  it("changes the password", async () => {
    changeUserPassword.mockResolvedValue(undefined);
    const response = await PATCH(
      new Request("http://localhost/api/v1/account", {
        method: "PATCH",
        body: JSON.stringify({ currentPassword: "old-password", newPassword: "new-password-123" })
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(changeUserPassword).toHaveBeenCalledWith("user-1", "old-password", "new-password-123");
  });

  it("rejects a short new password", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/v1/account", {
        method: "PATCH",
        body: JSON.stringify({ currentPassword: "old-password", newPassword: "short" })
      })
    );
    expect(response.status).toBe(400);
    expect(changeUserPassword).not.toHaveBeenCalled();
  });

  it("returns 401 for the wrong current password", async () => {
    changeUserPassword.mockRejectedValue(new Error("Invalid password"));
    const response = await PATCH(
      new Request("http://localhost/api/v1/account", {
        method: "PATCH",
        body: JSON.stringify({ currentPassword: "wrong-password", newPassword: "new-password-123" })
      })
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "invalid_password" });
  });
});
