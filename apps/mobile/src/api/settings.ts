import { z } from "zod";
import { api } from "./client";

export const mobileSettingsSchema = z.object({
  modelProvider: z.enum(["openai", "anthropic", "deepseek", "minimax", "kimi", "glm", "custom"]),
  modelName: z.string(),
  modelBaseUrl: z.string(),
  hasApiKey: z.boolean(),
  apiKeyHint: z.string().nullable(),
  dataMcpConnections: z.array(
    z.object({
      id: z.enum(["coros", "calendar", "meal_menu"]),
      label: z.string(),
      enabled: z.boolean(),
      endpoint: z.string(),
      transport: z.enum(["http", "stdio"]).optional(),
      corosRegion: z.enum(["china", "us", "eu"]).optional(),
      larkSessionHint: z.string().optional(),
      auth: z.object({
        type: z.enum(["none", "bearer", "api_key", "basic", "oauth2"]),
        tokenHint: z.string().optional(),
        apiKeyHint: z.string().optional(),
        passwordHint: z.string().optional(),
        accessTokenHint: z.string().optional(),
        expiresAt: z.string().optional()
      }).passthrough()
    }).passthrough()
  )
});

export type MobileSettings = z.infer<typeof mobileSettingsSchema>;
export type MobileMcpConnection = MobileSettings["dataMcpConnections"][number];

export function getSettings() {
  return api.get<MobileSettings>("/settings", mobileSettingsSchema);
}

/**
 * The server derives the model name and base URL from the provider, so they are
 * only sent for `custom`, the one provider it cannot resolve on its own.
 */
export function saveSettings(settings: MobileSettings, apiKey = "") {
  return api.post<MobileSettings>("/settings", {
    modelProvider: settings.modelProvider,
    ...(providerNeedsManualModel(settings.modelProvider)
      ? { modelName: settings.modelName, modelBaseUrl: settings.modelBaseUrl }
      : {}),
    apiKey,
    dataMcpConnections: settings.dataMcpConnections
  }, mobileSettingsSchema);
}

export function providerNeedsManualModel(provider: MobileSettings["modelProvider"]): boolean {
  return provider === "custom";
}

/**
 * Mirrors the server's provider table so switching a provider can preview the
 * model it resolves to before saving. The server stays authoritative: whatever
 * it returns after a save overwrites these values.
 */
export const modelProviderOptions = [
  {
    value: "openai",
    label: "OpenAI",
    model: "gpt-5.6-terra",
    baseUrl: "https://api.openai.com/v1",
    credentialSource: "在 platform.openai.com 创建密钥。"
  },
  {
    value: "anthropic",
    label: "Anthropic",
    model: "claude-opus-5",
    baseUrl: "https://api.anthropic.com/v1",
    credentialSource: "在 console.anthropic.com 创建密钥；Claude.ai 订阅不包含 API 访问。"
  },
  {
    value: "deepseek",
    label: "DeepSeek",
    model: "deepseek-v4-flash",
    baseUrl: "https://api.deepseek.com",
    credentialSource: "在 platform.deepseek.com 创建密钥。"
  },
  {
    value: "minimax",
    label: "MiniMax",
    model: "MiniMax-M3",
    baseUrl: "https://api.minimax.io/v1",
    credentialSource: "在 platform.minimax.io 创建密钥；国内站 minimaxi.com 是另一套账号。"
  },
  {
    value: "kimi",
    label: "Kimi",
    model: "kimi-k3",
    baseUrl: "https://api.moonshot.ai/v1",
    credentialSource: "在 Kimi 开放平台创建密钥（platform.kimi.ai，国内为 platform.moonshot.cn）；Kimi Code 编程会员的 sk-kim 密钥属于另一套系统，这里一定会被拒绝。"
  },
  {
    value: "glm",
    label: "GLM",
    model: "glm-5.2",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    credentialSource: "在 open.bigmodel.cn 创建密钥；国际站 z.ai 是另一套账号。"
  },
  { value: "custom", label: "自定义", model: "", baseUrl: "", credentialSource: "" }
] as const satisfies readonly {
  value: MobileSettings["modelProvider"];
  label: string;
  model: string;
  baseUrl: string;
  credentialSource: string;
}[];

/** Where a working key for this provider comes from. */
export function providerCredentialSource(provider: MobileSettings["modelProvider"]): string {
  return modelProviderOptions.find((option) => option.value === provider)?.credentialSource ?? "";
}

export function providerModelDefaults(provider: MobileSettings["modelProvider"]): {
  model: string;
  baseUrl: string;
} {
  const entry = modelProviderOptions.find((option) => option.value === provider);
  return { model: entry?.model ?? "", baseUrl: entry?.baseUrl ?? "" };
}

/**
 * The URLs mirror the server's official region map and are shown for
 * confirmation only; the server derives the endpoint it actually stores from
 * the region, so it stays authoritative if COROS ever moves a host.
 */
export const corosRegions = [
  { value: "china", label: "中国", url: "https://mcpcn.coros.com/mcp" },
  { value: "us", label: "北美及其他", url: "https://mcpus.coros.com/mcp" },
  { value: "eu", label: "欧洲", url: "https://mcpeu.coros.com/mcp" }
] as const;

export type CorosRegion = (typeof corosRegions)[number]["value"];

export function regionEndpoint(region: CorosRegion): string {
  return corosRegions.find((option) => option.value === region)?.url ?? "";
}

/** Pins the COROS region before the OAuth client is registered; the server resolves the endpoint. */
export function prepareCorosConnection(corosRegion: CorosRegion) {
  return api.post<{ ok: true }>("/settings/mcp/coros/prep", { corosRegion });
}

const oauthAuthorizationSchema = z.object({ url: z.string() });

/**
 * Uses the app's authenticated API request to prepare OAuth state and returns
 * the provider URL. The browser therefore opens COROS directly and never needs
 * to visit an HBM handoff page first.
 */
export function createOAuthAuthorizationUrl(connection: "coros" | "calendar" | "meal_menu") {
  return api.post<z.infer<typeof oauthAuthorizationSchema>>(
    `/settings/mcp/oauth/authorize?connection=${connection}`,
    {},
    oauthAuthorizationSchema
  );
}
