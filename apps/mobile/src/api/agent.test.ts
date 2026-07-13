import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-constants", () => ({
  default: {
    expoConfig: {
      extra: {
        apiBaseUrl: "http://localhost:3000"
      }
    }
  }
}));

const tokenStore = vi.hoisted(() => ({
  getAccessToken: vi.fn(),
  getRefreshToken: vi.fn(),
  setTokens: vi.fn(),
  resetTokens: vi.fn()
}));

vi.mock("../auth/tokenStore", () => ({
  getAccessToken: tokenStore.getAccessToken,
  getRefreshToken: tokenStore.getRefreshToken,
  setTokens: tokenStore.setTokens,
  resetTokens: tokenStore.resetTokens
}));

import { getAgentConversation, sendAgentMessage } from "./agent";

describe("mobile agent API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tokenStore.getAccessToken.mockResolvedValue("access-token");
    vi.stubGlobal("fetch", vi.fn());
  });

  it("loads a conversation with its messages", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "conv-1",
          title: "训练计划",
          updatedAt: "2026-07-02T03:00:00.000Z",
          messages: [{ id: "msg-1", role: "assistant", content: "可以安排恢复跑。" }]
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const conversation = await getAgentConversation("conv-1");

    expect(fetch).toHaveBeenCalledWith("http://localhost:3000/api/v1/agent/conversations/conv-1", expect.any(Object));
    expect(conversation.messages[0].content).toBe("可以安排恢复跑。");
  });

  it("sends a message to the selected conversation", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          message: "今天建议低强度训练。",
          conversation: { id: "conv-1", title: "今天训练", updatedAt: "2026-07-02T03:01:00.000Z" },
          adjustments: [{ id: "adj-1", label: "已将训练强度调整为 easy", undoneAt: null }]
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const response = await sendAgentMessage("conv-1", "今天训练怎么安排？");

    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3000/api/v1/agent",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ conversationId: "conv-1", message: "今天训练怎么安排？" })
      })
    );
    expect(response.message).toBe("今天建议低强度训练。");
    expect(response.adjustments?.[0].label).toContain("easy");
  });
});
