import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/src/db/client";
import { sendPushToUser } from "@/src/services/pushService";

vi.mock("@/src/db/client", () => ({ prisma: { pushToken: { findMany: vi.fn(), deleteMany: vi.fn() } } }));

describe("push service", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal("fetch", vi.fn()); });

  it("sends real Expo push messages", async () => {
    vi.mocked(prisma.pushToken.findMany).mockResolvedValue([{ id: "pt-1", token: "ExpoPushToken[abc]" }] as never);
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ data: [{ status: "ok", id: "ticket-1" }] }), { status: 200 }));
    await expect(sendPushToUser("user-1", { title: "训练提醒", body: "30 分钟后开始恢复跑" })).resolves.toEqual({ attempted: 1, sent: 1, failed: 0 });
    expect(fetch).toHaveBeenCalledWith("https://exp.host/--/api/v2/push/send", expect.objectContaining({ method: "POST" }));
  });

  it("removes tokens rejected as unregistered", async () => {
    vi.mocked(prisma.pushToken.findMany).mockResolvedValue([{ id: "pt-old", token: "ExponentPushToken[old]" }] as never);
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ data: [{ status: "error", details: { error: "DeviceNotRegistered" } }] }), { status: 200 }));
    await sendPushToUser("user-1", { title: "提醒", body: "训练" });
    expect(prisma.pushToken.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["pt-old"] }, userId: "user-1" } });
  });

  it("fails loudly when the gateway is unavailable", async () => {
    vi.mocked(prisma.pushToken.findMany).mockResolvedValue([{ id: "pt-1", token: "ExpoPushToken[abc]" }] as never);
    vi.mocked(fetch).mockResolvedValue(new Response("down", { status: 503 }));
    await expect(sendPushToUser("user-1", { title: "提醒", body: "训练" })).rejects.toThrow("HTTP 503");
  });
});
