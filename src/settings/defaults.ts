export type ModelProvider = "openai" | "anthropic" | "deepseek" | "minimax" | "kimi" | "glm" | "custom";

export type DataMcpConnectionId = "coros" | "calendar" | "meal_menu";

export type DataMcpAuthType = "none" | "bearer" | "api_key" | "basic" | "oauth2";
export type DataMcpTransport = "http" | "stdio";
export type CorosMcpRegion = "china" | "us" | "eu";
export type OAuthReturnTarget = "web" | "app";

export type DataMcpAuthConfig = {
  type: DataMcpAuthType;
  token?: string;
  tokenHint?: string;
  encryptedToken?: string;
  tokenIv?: string;
  tokenTag?: string;
  headerName?: string;
  apiKey?: string;
  apiKeyHint?: string;
  encryptedApiKey?: string;
  apiKeyIv?: string;
  apiKeyTag?: string;
  username?: string;
  password?: string;
  passwordHint?: string;
  encryptedPassword?: string;
  passwordIv?: string;
  passwordTag?: string;
  authorizeUrl?: string;
  tokenUrl?: string;
  clientId?: string;
  clientSecret?: string;
  clientSecretHint?: string;
  encryptedClientSecret?: string;
  clientSecretIv?: string;
  clientSecretTag?: string;
  scopes?: string;
  accessToken?: string;
  accessTokenHint?: string;
  encryptedAccessToken?: string;
  accessTokenIv?: string;
  accessTokenTag?: string;
  refreshToken?: string;
  refreshTokenHint?: string;
  encryptedRefreshToken?: string;
  refreshTokenIv?: string;
  refreshTokenTag?: string;
  expiresAt?: string;
  oauthState?: string;
  /** PKCE verifier (COROS OAuth); server-only, cleared after token exchange */
  oauthCodeVerifier?: string;
  /**
   * App origin the user started the OAuth flow from (e.g. http://localhost:3000); server-only.
   * The callback runs on the loopback IP origin (127.0.0.1) that COROS accepts as a redirect host,
   * so we redirect the browser back here afterwards to preserve the user's session.
   */
  oauthReturnOrigin?: string;
  /** Redirect URI used when the OAuth client was dynamically registered (must match each authorize/token redirect_uri) */
  oauthRegisteredRedirectUri?: string;
  /**
   * Which client started the flow; server-only. The web flow ends back on the
   * settings page, while a native flow ends on the app deep link so the in-app
   * browser closes itself instead of stranding the user on a web page.
   */
  oauthReturnTarget?: OAuthReturnTarget;
  /** Bumped when COROS registration shape changes; stale values force re-registration */
  corosOAuthRegistrationVersion?: number;
};

export type DataMcpConnection = {
  id: DataMcpConnectionId;
  label: string;
  enabled: boolean;
  serverName: string;
  capabilityName: string;
  transport?: DataMcpTransport;
  endpoint: string;
  command?: string;
  args?: string;
  canteenName?: string;
  larkSession?: string;
  larkSessionHint?: string;
  encryptedLarkSession?: string;
  larkSessionIv?: string;
  larkSessionTag?: string;
  auth: DataMcpAuthConfig;
  loginUrl?: string;
  corosRegion?: CorosMcpRegion;
  notes: string;
};

export type SettingsView = {
  modelProvider: ModelProvider;
  modelName: string;
  modelBaseUrl: string;
  hasApiKey: boolean;
  apiKeyHint: string | null;
  dataMcpConnections: DataMcpConnection[];
};

/**
 * Model identity is derived from the provider rather than typed in, so bumping
 * a `defaultModel` here rolls every existing account onto the newer model
 * without a data migration. `custom` is the sole escape hatch for relays and
 * self-hosted gateways, and is the only provider whose model name and base URL
 * come from the user.
 */
export const modelProviders: Array<{
  value: ModelProvider;
  label: string;
  defaultModel: string;
  defaultBaseUrl: string;
  /**
   * Where a working key comes from. Surfaced verbatim on a 401, because every
   * provider here has at least one neighbouring product whose keys look
   * identical but are issued by a separate account system.
   */
  credentialSource: string;
}> = [
  {
    value: "openai",
    label: "OpenAI",
    defaultModel: "gpt-5.6-terra",
    defaultBaseUrl: "https://api.openai.com/v1",
    credentialSource: "Create the key at platform.openai.com."
  },
  {
    value: "deepseek",
    label: "DeepSeek",
    defaultModel: "deepseek-v4-flash",
    defaultBaseUrl: "https://api.deepseek.com",
    credentialSource: "Create the key at platform.deepseek.com."
  },
  {
    value: "minimax",
    label: "MiniMax",
    defaultModel: "MiniMax-M3",
    defaultBaseUrl: "https://api.minimax.io/v1",
    credentialSource: "Create the key at platform.minimax.io; keys from the mainland platform (minimaxi.com) are a separate account."
  },
  {
    value: "kimi",
    label: "Kimi / Moonshot",
    defaultModel: "kimi-k3",
    defaultBaseUrl: "https://api.moonshot.ai/v1",
    credentialSource:
      "Create the key on the Kimi Open Platform (platform.kimi.ai, or platform.moonshot.cn in mainland China). Kimi Code keys, which start with sk-kim and belong to the coding membership at api.kimi.com, are a separate system and are always rejected here."
  },
  {
    value: "glm",
    label: "GLM / Zhipu",
    defaultModel: "glm-5.2",
    defaultBaseUrl: "https://open.bigmodel.cn/api/paas/v4",
    credentialSource: "Create the key at open.bigmodel.cn; keys from the international z.ai platform are a separate account."
  },
  {
    value: "anthropic",
    label: "Anthropic",
    defaultModel: "claude-opus-5",
    defaultBaseUrl: "https://api.anthropic.com/v1",
    credentialSource: "Create the key at console.anthropic.com; a Claude.ai subscription does not include API access."
  },
  { value: "custom", label: "Custom", defaultModel: "", defaultBaseUrl: "", credentialSource: "" }
];

export function getProviderCredentialSource(provider: ModelProvider): string {
  return modelProviders.find((item) => item.value === provider)?.credentialSource ?? "";
}

/** Only `custom` lets the user pick the model name and base URL themselves. */
export function providerNeedsManualModel(provider: ModelProvider): boolean {
  return provider === "custom";
}

export function resolveProviderModelDefaults(provider: ModelProvider): {
  modelName: string;
  modelBaseUrl: string;
} {
  const entry = modelProviders.find((item) => item.value === provider);
  return { modelName: entry?.defaultModel ?? "", modelBaseUrl: entry?.defaultBaseUrl ?? "" };
}

export const corosMcpUrlByRegion: Record<CorosMcpRegion, string> = {
  china: "https://mcpcn.coros.com/mcp",
  us: "https://mcpus.coros.com/mcp",
  eu: "https://mcpeu.coros.com/mcp"
};

export const corosMcpRegionOptions: Array<{
  value: CorosMcpRegion;
  label: string;
  url: string;
}> = [
  { value: "china", label: "China", url: corosMcpUrlByRegion.china },
  { value: "us", label: "North America or other regions", url: corosMcpUrlByRegion.us },
  { value: "eu", label: "Europe", url: corosMcpUrlByRegion.eu }
];

export const defaultDataMcpConnections: DataMcpConnection[] = [
  {
    id: "coros",
    label: "COROS",
    enabled: true,
    serverName: "coros",
    capabilityName: "daily-health",
    transport: "http",
    endpoint: "",
    loginUrl: "",
    auth: { type: "none" },
    notes: "Workout, sleep, HRV, recovery, and training load."
  },
  {
    id: "calendar",
    label: "Calendar",
    enabled: true,
    serverName: "calendar",
    capabilityName: "agenda",
    transport: "http",
    endpoint: "",
    loginUrl: "",
    auth: { type: "none" },
    notes: "Schedule, free windows, and training event drafts."
  },
  {
    id: "meal_menu",
    label: "Meal Menu",
    enabled: true,
    serverName: "meal-menu",
    capabilityName: "today-menu",
    transport: "http",
    endpoint: "",
    command: "npx",
    args: "-y @byted/mcp-bytecanteen@latest",
    canteenName: "",
    loginUrl: "",
    auth: { type: "none" },
    notes: "Daily breakfast, lunch, dinner, and nutrition choices."
  }
];

export const defaultSettingsView: SettingsView = {
  modelProvider: "openai",
  ...resolveProviderModelDefaults("openai"),
  hasApiKey: false,
  apiKeyHint: null,
  dataMcpConnections: defaultDataMcpConnections
};
