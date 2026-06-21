import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAgentResponse, createAgentResponseForUser } from "@/src/services/agent";
import { loadModelRuntimeConfig } from "@/src/settings/service";

vi.mock("@/src/settings/service", () => ({
  loadModelRuntimeConfig: vi.fn()
}));

describe("agent response shell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("routes sleep-related questions to a conservative training explanation", () => {
    const response = createAgentResponse("我昨晚没睡好，今天还适合跑吗？");

    expect(response.intent).toBe("recovery_check");
    expect(response.message).toContain("recovery");
  });

  it("routes calendar write requests to confirmation flow", () => {
    const response = createAgentResponse("帮我把本周训练写入飞书日历");

    expect(response.intent).toBe("calendar_confirmation");
  });

  it("routes weekly activity data questions to training analysis", () => {
    const response = createAgentResponse("看下我这周的运动数据");

    expect(response.intent).toBe("training_analysis");
  });

  it("routes meal questions to menu advice", () => {
    const response = createAgentResponse("今天午餐这些菜怎么选？");

    expect(response.intent).toBe("menu_advice");
  });

  it("calls the configured OpenAI-compatible model when settings are available", async () => {
    vi.mocked(loadModelRuntimeConfig).mockResolvedValue({
      provider: "deepseek",
      providerLabel: "DeepSeek",
      modelName: "deepseek-v4-flash",
      baseUrl: "https://api.deepseek.com",
      apiKey: "sk-configured"
    });
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "今天建议做轻松跑，并注意补水。" } }]
      })
    } as never);

    const response = await createAgentResponseForUser("user-1", "今天怎么训练？", [
      { role: "user", content: "昨天做了间歇跑" }
    ]);

    expect(fetch).toHaveBeenCalledWith(
      "https://api.deepseek.com/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer sk-configured",
          "Content-Type": "application/json"
        })
      })
    );
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body))).toEqual(
      expect.objectContaining({
        model: "deepseek-v4-flash",
        messages: expect.arrayContaining([
          expect.objectContaining({ role: "system" }),
          expect.objectContaining({ role: "user", content: "今天怎么训练？" })
        ])
      })
    );
    expect(response).toEqual(
      expect.objectContaining({
        source: "model",
        modelProvider: "DeepSeek",
        modelName: "deepseek-v4-flash",
        message: "今天建议做轻松跑，并注意补水。"
      })
    );
  });

  it("includes app context in configured model prompts", async () => {
    vi.mocked(loadModelRuntimeConfig).mockResolvedValue({
      provider: "deepseek",
      providerLabel: "DeepSeek",
      modelName: "deepseek-v4-flash",
      baseUrl: "https://api.deepseek.com",
      apiKey: "sk-configured"
    });
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "建议今天降强度。" } }] })
    } as never);

    await createAgentResponseForUser("user-1", "今天能跑吗？", [], {
      intent: "recovery_check",
      freshSync: { attempted: true, succeeded: false, error: "COROS MCP endpoint is not configured." },
      sections: [{ title: "Recent recovery", content: "2026-06-20: recovery 64%, HRV 45." }]
    });

    const payload = JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body));
    expect(payload.messages[0].content).toContain("Recent recovery");
    expect(payload.messages[0].content).toContain("COROS MCP endpoint is not configured");
  });

  it("adds intent-specific instructions to configured model prompts", async () => {
    vi.mocked(loadModelRuntimeConfig).mockResolvedValue({
      provider: "deepseek",
      providerLabel: "DeepSeek",
      modelName: "deepseek-v4-flash",
      baseUrl: "https://api.deepseek.com",
      apiKey: "sk-configured"
    });
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "今天建议恢复训练。" } }] })
    } as never);

    await createAgentResponseForUser("user-1", "昨晚没睡好，今天还能跑吗？", [], {
      intent: "recovery_check",
      freshSync: { attempted: false, succeeded: false },
      sections: [{ title: "Recent sleep", content: "2026-06-20: 360 min, score 58." }]
    });

    const payload = JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body));
    expect(payload.messages[0].content).toContain("Recovery check instructions:");
    expect(payload.messages[0].content).toContain("prioritize sleep quality, recovery score, HRV, resting heart rate, and recent hard sessions");
    expect(payload.messages[0].content).toContain("If you use a table, include at least one data row");
    expect(payload.messages[0].content).not.toContain("Calendar confirmation instructions:");
  });

  it("falls back instead of using an incomplete OpenAI-compatible model response", async () => {
    vi.mocked(loadModelRuntimeConfig).mockResolvedValue({
      provider: "deepseek",
      providerLabel: "DeepSeek",
      modelName: "deepseek-v4-flash",
      baseUrl: "https://api.deepseek.com",
      apiKey: "sk-configured"
    });
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            finish_reason: "length",
            message: { content: "好的，以下是对你 **6月15日（周一）至6月20日（周六）** 这一周运动" }
          }
        ]
      })
    } as never);

    const response = await createAgentResponseForUser("user-1", "分析我这周的运动数据");

    expect(response.source).toBe("rules");
    expect(response.error).toBe("DeepSeek response was cut off before completion.");
    expect(response.message).toContain("DeepSeek response was cut off");
    expect(response.message).toContain("using local guidance instead");
    expect(response.message).not.toContain("这一周运动");
  });

  it("shows the provider error when the configured model call fails", async () => {
    vi.mocked(loadModelRuntimeConfig).mockResolvedValue({
      provider: "custom",
      providerLabel: "Custom",
      modelName: "local-loopback-model-updated",
      baseUrl: "http://127.0.0.1:3002/login",
      apiKey: "sk-configured"
    });
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({})
    } as never);

    const response = await createAgentResponseForUser("user-1", "你好");

    expect(response.source).toBe("rules");
    expect(response.error).toBe("Custom returned HTTP 404.");
    expect(response.message).toContain("Custom returned HTTP 404");
    expect(response.message).toContain("using local guidance instead");
  });
});
