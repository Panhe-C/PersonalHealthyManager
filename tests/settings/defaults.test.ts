import { describe, expect, it } from "vitest";
import { modelProviders, providerNeedsManualModel, resolveProviderModelDefaults } from "@/src/settings/defaults";

describe("settings defaults", () => {
  it("pins every hosted provider to a current model and base URL", () => {
    expect(modelProviders).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          value: "openai",
          label: "OpenAI",
          defaultModel: "gpt-5.6-terra",
          defaultBaseUrl: "https://api.openai.com/v1"
        }),
        expect.objectContaining({
          value: "anthropic",
          label: "Anthropic",
          defaultModel: "claude-opus-5",
          defaultBaseUrl: "https://api.anthropic.com/v1"
        }),
        expect.objectContaining({
          value: "deepseek",
          label: "DeepSeek",
          defaultModel: "deepseek-v4-flash",
          defaultBaseUrl: "https://api.deepseek.com"
        }),
        expect.objectContaining({
          value: "minimax",
          label: "MiniMax",
          defaultModel: "MiniMax-M3",
          defaultBaseUrl: "https://api.minimax.io/v1"
        }),
        expect.objectContaining({
          value: "kimi",
          label: "Kimi / Moonshot",
          defaultModel: "kimi-k3",
          defaultBaseUrl: "https://api.moonshot.ai/v1"
        }),
        expect.objectContaining({
          value: "glm",
          label: "GLM / Zhipu",
          defaultModel: "glm-5.2",
          defaultBaseUrl: "https://open.bigmodel.cn/api/paas/v4"
        })
      ])
    );
  });

  it("leaves only the custom provider without resolvable defaults", () => {
    for (const provider of modelProviders) {
      const defaults = resolveProviderModelDefaults(provider.value);
      if (providerNeedsManualModel(provider.value)) {
        expect(defaults).toEqual({ modelName: "", modelBaseUrl: "" });
      } else {
        expect(defaults.modelName).not.toBe("");
        expect(defaults.modelBaseUrl).toMatch(/^https:\/\//);
      }
    }
  });

  it("treats custom as the only provider needing manual entry", () => {
    const manual = modelProviders.filter((provider) => providerNeedsManualModel(provider.value));
    expect(manual.map((provider) => provider.value)).toEqual(["custom"]);
  });
});
