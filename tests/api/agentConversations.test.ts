import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE } from "@/app/api/agent/conversations/[id]/route";
import { deleteAgentConversationForUser } from "@/src/services/agentConversations";

vi.mock("@/src/auth/api", () => ({
  withUser:
    (handler: (...args: unknown[]) => Promise<Response>) =>
    (request: Request, context: unknown) =>
      handler({ id: "user-1", timezone: "Asia/Shanghai" }, request, context)
}));

vi.mock("@/src/services/agentConversations", () => ({
  deleteAgentConversationForUser: vi.fn(),
  getAgentConversationForUser: vi.fn()
}));

describe("agent conversations API", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes a current-user conversation", async () => {
    vi.mocked(deleteAgentConversationForUser).mockResolvedValue(true);

    const response = await DELETE(new Request("http://localhost/api/agent/conversations/conv-1", { method: "DELETE" }), {
      params: Promise.resolve({ id: "conv-1" })
    });

    expect(deleteAgentConversationForUser).toHaveBeenCalledWith("user-1", "conv-1");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ deleted: true });
  });

  it("returns 404 for a missing or unauthorized conversation", async () => {
    vi.mocked(deleteAgentConversationForUser).mockResolvedValue(false);

    const response = await DELETE(new Request("http://localhost/api/agent/conversations/conv-other", { method: "DELETE" }), {
      params: Promise.resolve({ id: "conv-other" })
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Conversation not found" });
  });
});
