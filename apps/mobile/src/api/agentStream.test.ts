import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-constants", () => ({
  default: { expoConfig: { extra: { apiBaseUrl: "http://localhost:3000" } } }
}));

const tokenStore = vi.hoisted(() => ({
  getAccessToken: vi.fn(),
  getRefreshToken: vi.fn(),
  setTokens: vi.fn(),
  resetTokens: vi.fn()
}));
const expoFetch = vi.hoisted(() => vi.fn());

vi.mock("../auth/tokenStore", () => tokenStore);
vi.mock("expo/fetch", () => ({ fetch: expoFetch }));

import { streamAgentMessage } from "./agentStream";

const conversation = {
  id: "conv-1",
  title: "训练建议",
  updatedAt: "2026-07-30T02:00:00.000Z"
};

function streamResponse(lines: unknown[]) {
  const bytes = new TextEncoder().encode(lines.map((line) => `${JSON.stringify(line)}\n`).join(""));
  const split = Math.max(1, Math.floor(bytes.byteLength / 3));
  return new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(bytes.slice(0, split));
      controller.enqueue(bytes.slice(split, split * 2));
      controller.enqueue(bytes.slice(split * 2));
      controller.close();
    }
  }), {
    status: 200,
    headers: { "Content-Type": "application/x-ndjson" }
  });
}

describe("mobile agent streaming API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tokenStore.getAccessToken.mockResolvedValue("access-token");
    tokenStore.getRefreshToken.mockReturnValue("refresh-token");
    vi.stubGlobal("fetch", vi.fn());
  });

  it("reads NDJSON incrementally and delivers ordered events", async () => {
    expoFetch.mockResolvedValue(streamResponse([
      { type: "start", requestId: "req-1" },
      { type: "delta", text: "建议" },
      { type: "delta", text: "恢复跑。" },
      {
        type: "final",
        message: "建议恢复跑。",
        intent: "general",
        source: "model",
        conversation,
        adjustments: [],
        appliedMemories: []
      }
    ]));
    const events: string[] = [];

    await streamAgentMessage("conv-1", "今天怎么练？", {
      onEvent: (event) => events.push(event.type === "delta" ? `${event.type}:${event.text}` : event.type)
    });

    expect(events).toEqual(["start", "delta:建议", "delta:恢复跑。", "final"]);
    expect(expoFetch).toHaveBeenCalledWith(
      "http://localhost:3000/api/v1/agent",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Accept: "application/x-ndjson",
          Authorization: "Bearer access-token"
        }),
        body: JSON.stringify({ conversationId: "conv-1", message: "今天怎么练？" })
      })
    );
  });

  it("rejects a stream that ends without a terminal event", async () => {
    expoFetch.mockResolvedValue(streamResponse([
      { type: "start", requestId: "req-2" },
      { type: "delta", text: "部分内容" }
    ]));

    await expect(streamAgentMessage("conv-1", "继续", { onEvent: vi.fn() })).rejects.toThrow(
      "terminal event"
    );
  });

  it("refreshes once and retries after an unauthorized stream request", async () => {
    expoFetch
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(streamResponse([
        { type: "start", requestId: "req-3" },
        {
          type: "final",
          message: "完成",
          intent: "general",
          source: "model",
          conversation,
          adjustments: [],
          appliedMemories: []
        }
      ]));
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      accessToken: "refreshed-token",
      refreshToken: "next-refresh-token",
      accessExpiresAt: "2026-07-30T03:00:00.000Z"
    }), { status: 200 }));

    await streamAgentMessage("conv-1", "重试", { onEvent: vi.fn() });

    expect(expoFetch).toHaveBeenCalledTimes(2);
    expect(expoFetch).toHaveBeenLastCalledWith(
      "http://localhost:3000/api/v1/agent",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer refreshed-token" })
      })
    );
    expect(tokenStore.setTokens).toHaveBeenCalledOnce();
  });
});
