import { describe, expect, it } from "vitest";
import { modelProviders } from "@/src/settings/defaults";

describe("settings defaults", () => {
  it("includes Chinese OpenAI-compatible model providers with editable defaults", () => {
    expect(modelProviders).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          value: "deepseek",
          label: "DeepSeek",
          defaultModel: "deepseek-v4-flash",
          defaultBaseUrl: "https://api.deepseek.com"
        }),
        expect.objectContaining({
          value: "minimax",
          label: "MiniMax",
          defaultModel: "MiniMax-M1",
          defaultBaseUrl: "https://api.minimax.io/v1"
        }),
        expect.objectContaining({
          value: "kimi",
          label: "Kimi / Moonshot",
          defaultModel: "kimi-k2.6",
          defaultBaseUrl: "https://api.moonshot.ai/v1"
        }),
        expect.objectContaining({
          value: "glm",
          label: "GLM / Zhipu",
          defaultModel: "glm-5.1",
          defaultBaseUrl: "https://open.bigmodel.cn/api/paas/v4"
        })
      ])
    );
  });
});
