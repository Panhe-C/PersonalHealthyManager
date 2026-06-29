import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/src/auth/api", () => ({
  withUser:
    (handler: (...args: unknown[]) => Promise<Response>) =>
    (request: Request) =>
      handler({ id: "user-1", timezone: "Asia/Shanghai" }, request)
}));

const { deleteUserAccount } = vi.hoisted(() => ({ deleteUserAccount: vi.fn() }));

vi.mock("@/src/services/accountService", () => ({ deleteUserAccount }));

import { DELETE } from "@/app/api/v1/account/route";

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
