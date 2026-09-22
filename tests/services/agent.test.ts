import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAgentResponse,
  createAgentResponseForUser,
  createStreamingAgentResponseForUser
} from "@/src/services/agent";
import { loadModelRuntimeConfig } from "@/src/settings/service";

vi.mock("@/src/settings/service", () => ({
  loadModelRuntimeConfig: vi.fn()
}));

const deepSeekConfig = {
  provider: "deepseek" as const,
  providerLabel: "DeepSeek",
  modelName: "deepseek-chat",
  baseUrl: "https://api.deepseek.com",
  apiKey: "sk-configured"
};

function sseResponse(records: string[]) {
  const encoder = new TextEncoder();
  return new Response(new ReadableStream({
    start(controller) {
      records.forEach((record) => controller.enqueue(encoder.encode(record)));
      controller.close();
    }
  }), { status: 200, headers: { "Content-Type": "text/event-stream" } });
}

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

  it("keeps the prior health intent for an explicit COROS follow-up", () => {
    const response = createAgentResponse("从 coros 的 mcp 查一下看看", [
      { role: "user", content: "看下我昨晚的睡眠数据" },
      { role: "assistant", content: "目前没有昨晚的同步结果。" }
    ]);

    expect(response.intent).toBe("recovery_check");
  });

  it("does not carry an unrelated intent into a COROS follow-up", () => {
    const response = createAgentResponse("从 coros 的 mcp 查一下看看", [
      { role: "user", content: "帮我把训练写入飞书日历" },
      { role: "assistant", content: "我可以先生成日历草稿。" }
    ]);

    expect(response.intent).toBe("general");
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

  it("sends image attachments as multimodal content to OpenAI-compatible providers", async () => {
    vi.mocked(loadModelRuntimeConfig).mockResolvedValue(deepSeekConfig);
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "这是一份训练餐。" } }] })
    } as never);
    const dataUrl = `data:image/png;base64,${Buffer.from("image").toString("base64")}`;

    await createAgentResponseForUser("user-1", "分析这张图", [], undefined, [{
      id: "image-1",
      name: "meal.png",
      mimeType: "image/png",
      size: 5,
      dataUrl
    }]);

    const payload = JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body));
    expect(payload.messages.at(-1)).toEqual({
      role: "user",
      content: [
        { type: "text", text: "分析这张图" },
        { type: "image_url", image_url: { url: dataUrl, detail: "auto" } }
      ]
    });
  });

  it("does not pretend to analyze attachments without a configured model", async () => {
    vi.mocked(loadModelRuntimeConfig).mockResolvedValue(null);
    const response = await createAgentResponseForUser("user-1", "分析", [], undefined, [{
      id: "file-1",
      name: "notes.txt",
      mimeType: "text/plain",
      size: 5,
      dataUrl: `data:text/plain;base64,${Buffer.from("hello").toString("base64")}`
    }]);

    expect(response.message).toContain("没有配置可分析附件的模型");
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

  it("keeps a truncated OpenAI-compatible model response instead of local fallback", async () => {
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

    expect(response.source).toBe("model");
    expect(response.truncated).toBe(true);
    expect(response.error).toBe("DeepSeek response was cut off before completion.");
    expect(response.message).toContain("这一周运动");
    expect(response.message).not.toContain("using local guidance instead");
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body))).toMatchObject({
      max_tokens: 8192
    });
  });

  it("falls back when a truncated OpenAI-compatible response has no usable text", async () => {
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
        choices: [{ finish_reason: "length", message: { content: "   " } }]
      })
    } as never);

    const response = await createAgentResponseForUser("user-1", "分析我这周的运动数据");

    expect(response.source).toBe("rules");
    expect(response.error).toBe("DeepSeek response was cut off before completion.");
    expect(response.message).toContain("using local guidance instead");
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

  it("names the platform that issues a working key when the provider rejects it", async () => {
    vi.mocked(loadModelRuntimeConfig).mockResolvedValue({
      provider: "kimi",
      providerLabel: "Kimi / Moonshot",
      modelName: "kimi-k3",
      baseUrl: "https://api.moonshot.ai/v1",
      apiKey: "sk-kim-wrong-product"
    });
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: "Invalid Authentication" } })
    } as never);

    const response = await createAgentResponseForUser("user-1", "你好");

    expect(response.error).toContain("Invalid Authentication");
    expect(response.error).toContain("platform.kimi.ai");
    expect(response.error).toContain("Kimi Code");
  });

  it("leaves a non-auth provider error unannotated", async () => {
    vi.mocked(loadModelRuntimeConfig).mockResolvedValue({
      provider: "kimi",
      providerLabel: "Kimi / Moonshot",
      modelName: "kimi-k3",
      baseUrl: "https://api.moonshot.ai/v1",
      apiKey: "sk-configured"
    });
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: { message: "Rate limit reached" } })
    } as never);

    const response = await createAgentResponseForUser("user-1", "你好");

    expect(response.error).toBe("Rate limit reached");
  });

  it("streams OpenAI-compatible deltas and retains private control blocks", async () => {
    vi.mocked(loadModelRuntimeConfig).mockResolvedValue(deepSeekConfig);
    vi.mocked(fetch).mockResolvedValue(sseResponse([
      'data: {"choices":[{"delta":{"content":"<explanation>建议"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"恢复跑。</explanation><actions>[]</actions>"},' +
        '"finish_reason":"stop"}]}\n\n',
      "data: [DONE]\n\n"
    ]));
    const deltas: string[] = [];

    const result = await createStreamingAgentResponseForUser(
      "user-1", "今天怎么练？", [], undefined, (text) => {
        deltas.push(text);
      }
    );

    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body))).toMatchObject({
      stream: true
    });
    expect(deltas.join("")).toBe("建议恢复跑。");
    expect(result.message).toContain("<actions>[]</actions>");
    expect(result.source).toBe("model");
  });

  it("streams Anthropic text deltas through the same visible contract", async () => {
    vi.mocked(loadModelRuntimeConfig).mockResolvedValue({
      provider: "anthropic",
      providerLabel: "Anthropic",
      modelName: "claude-sonnet",
      baseUrl: "https://api.anthropic.com/v1",
      apiKey: "sk-ant"
    });
    vi.mocked(fetch).mockResolvedValue(sseResponse([
      'event: content_block_delta\ndata: {"type":"content_block_delta",' +
        '"delta":{"type":"text_delta","text":"<explanation>先休息。"}}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta",' +
        '"delta":{"type":"text_delta","text":"</explanation>"}}\n\n',
      'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}\n\n',
      'event: message_stop\ndata: {"type":"message_stop"}\n\n'
    ]));
    const deltas: string[] = [];

    const result = await createStreamingAgentResponseForUser(
      "user-1", "今天怎么练？", [], undefined, (text) => {
        deltas.push(text);
      }
    );

    expect(deltas.join("")).toBe("先休息。");
    expect(result).toMatchObject({ source: "model", modelProvider: "Anthropic" });
  });

  it("keeps truncated stream text without replacing it with local guidance", async () => {
    vi.mocked(loadModelRuntimeConfig).mockResolvedValue(deepSeekConfig);
    vi.mocked(fetch).mockResolvedValue(sseResponse([
      'data: {"choices":[{"delta":{"content":"<explanation>不完整"},' +
        '"finish_reason":"length"}]}\n\n',
      "data: [DONE]\n\n"
    ]));
    const deltas: string[] = [];

    const result = await createStreamingAgentResponseForUser(
      "user-1", "分析本周训练", [], undefined, (text) => {
        deltas.push(text);
      }
    );

    expect(deltas.join("")).toBe("不完整");
    expect(result.source).toBe("model");
    expect(result.truncated).toBe(true);
    expect(result.error).toContain("cut off");
    expect(result.message).toContain("不完整");
    expect(deltas.join("")).not.toContain("using local guidance instead");
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body))).toMatchObject({
      max_tokens: 8192
    });
  });

  it("falls back when an OpenAI-compatible stream ends without DONE", async () => {
    vi.mocked(loadModelRuntimeConfig).mockResolvedValue(deepSeekConfig);
    vi.mocked(fetch).mockResolvedValue(sseResponse([
      'data: {"choices":[{"delta":{"content":"<explanation>中断"}}]}\n\n'
    ]));

    const result = await createStreamingAgentResponseForUser(
      "user-1", "分析本周训练", [], undefined, vi.fn()
    );

    expect(result.source).toBe("rules");
    expect(result.error).toContain("ended before completion");
  });

  it("falls back when OpenAI sends DONE without a successful finish reason", async () => {
    vi.mocked(loadModelRuntimeConfig).mockResolvedValue(deepSeekConfig);
    vi.mocked(fetch).mockResolvedValue(sseResponse([
      'data: {"choices":[{"delta":{"content":"<explanation>部分</explanation><actions>[]</actions>"}}]}\n\n',
      "data: [DONE]\n\n"
    ]));

    const result = await createStreamingAgentResponseForUser(
      "user-1", "分析本周训练", [], undefined, vi.fn()
    );

    expect(result.source).toBe("rules");
    expect(result.error).toContain("completion reason");
  });

  it("falls back when Anthropic stops without a successful stop reason", async () => {
    vi.mocked(loadModelRuntimeConfig).mockResolvedValue({
      provider: "anthropic",
      providerLabel: "Anthropic",
      modelName: "claude-sonnet",
      baseUrl: "https://api.anthropic.com/v1",
      apiKey: "sk-ant"
    });
    vi.mocked(fetch).mockResolvedValue(sseResponse([
      'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"<explanation>部分</explanation><memories>[]</memories>"}}\n\n',
      'event: message_stop\ndata: {"type":"message_stop"}\n\n'
    ]));

    const result = await createStreamingAgentResponseForUser(
      "user-1", "分析本周训练", [], undefined, vi.fn()
    );

    expect(result.source).toBe("rules");
    expect(result.error).toContain("completion reason");
  });

  it("preserves AbortError instead of converting cancellation to fallback", async () => {
    vi.mocked(loadModelRuntimeConfig).mockResolvedValue(deepSeekConfig);
    vi.mocked(fetch).mockRejectedValue(new DOMException("aborted", "AbortError"));
    const controller = new AbortController();
    controller.abort();

    await expect(createStreamingAgentResponseForUser(
      "user-1", "分析本周训练", [], undefined, vi.fn(), controller.signal
    )).rejects.toMatchObject({ name: "AbortError" });
  });
});
