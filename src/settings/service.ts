import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/src/db/client";
import {
  COROS_OAUTH_DEFAULT_SCOPES,
  COROS_OAUTH_REGISTRATION_VERSION,
  discoverCorosMcpOAuthEndpoints,
  registerCorosOAuthClient
} from "@/src/providers/coros-mcp";
import { decryptApiKey, decryptSecret, encryptApiKey, encryptSecret } from "@/src/settings/crypto";
import {
  corosMcpRegionOptions,
  corosMcpUrlByRegion,
  defaultDataMcpConnections,
  defaultSettingsView,
  getProviderCredentialSource,
  modelProviders,
  providerNeedsManualModel,
  resolveProviderModelDefaults,
  type CorosMcpRegion,
  type DataMcpAuthConfig,
  type DataMcpAuthType,
  type DataMcpConnection,
  type DataMcpConnectionId,
  type DataMcpTransport,
  type ModelProvider,
  type OAuthReturnTarget,
  type SettingsView
} from "@/src/settings/defaults";

function base64UrlNoPad(data: Buffer): string {
  return data
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** RFC 7636 PKCE for COROS (authorization server advertises S256). */
function createOAuthPkceS256Pair(): { verifier: string; challenge: string } {
  const verifier = base64UrlNoPad(randomBytes(32));
  const challenge = base64UrlNoPad(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

type SettingsRecord = {
  modelProvider: string;
  modelName: string;
  modelBaseUrl: string | null;
  encryptedApiKey: string | null;
  apiKeyIv: string | null;
  apiKeyTag: string | null;
  apiKeyHint: string | null;
  dataMcpConnectionsJson: string;
};

type SecretFieldNames = {
  input: keyof DataMcpAuthConfig;
  encrypted: keyof DataMcpAuthConfig;
  iv: keyof DataMcpAuthConfig;
  tag: keyof DataMcpAuthConfig;
  hint: keyof DataMcpAuthConfig;
};

export type SettingsSaveInput = {
  modelProvider: ModelProvider;
  /** Ignored unless the provider is `custom`. */
  modelName?: string;
  /** Ignored unless the provider is `custom`. */
  modelBaseUrl?: string;
  apiKey?: string;
  dataMcpConnections: DataMcpConnection[];
};

export type SettingsTestDraftInput = {
  modelProvider?: ModelProvider;
  modelName?: string;
  modelBaseUrl?: string;
  apiKey?: string;
  dataMcpConnections?: DataMcpConnection[];
};

export type ModelRuntimeConfig = {
  provider: ModelProvider;
  providerLabel: string;
  modelName: string;
  baseUrl: string;
  apiKey: string;
};

export type SettingsTestTarget = "model" | DataMcpConnectionId | "all";

export type SettingsTestResult = {
  id: string;
  label: string;
  status: "connected" | "failed" | "not_configured" | "auth_required";
  message: string;
  latencyMs: number | null;
};

const knownProviderValues = new Set(modelProviders.map((provider) => provider.value));
const knownConnectionIds = new Set(defaultDataMcpConnections.map((connection) => connection.id));
const knownAuthTypes = new Set<DataMcpAuthType>(["none", "bearer", "api_key", "basic", "oauth2"]);
const knownDataMcpTransports = new Set<DataMcpTransport>(["http", "stdio"]);
const knownCorosRegions = new Set(corosMcpRegionOptions.map((region) => region.value));

const tokenFields: SecretFieldNames = {
  input: "token",
  encrypted: "encryptedToken",
  iv: "tokenIv",
  tag: "tokenTag",
  hint: "tokenHint"
};

const apiKeyFields: SecretFieldNames = {
  input: "apiKey",
  encrypted: "encryptedApiKey",
  iv: "apiKeyIv",
  tag: "apiKeyTag",
  hint: "apiKeyHint"
};

const passwordFields: SecretFieldNames = {
  input: "password",
  encrypted: "encryptedPassword",
  iv: "passwordIv",
  tag: "passwordTag",
  hint: "passwordHint"
};

const clientSecretFields: SecretFieldNames = {
  input: "clientSecret",
  encrypted: "encryptedClientSecret",
  iv: "clientSecretIv",
  tag: "clientSecretTag",
  hint: "clientSecretHint"
};

const accessTokenFields: SecretFieldNames = {
  input: "accessToken",
  encrypted: "encryptedAccessToken",
  iv: "accessTokenIv",
  tag: "accessTokenTag",
  hint: "accessTokenHint"
};

const refreshTokenFields: SecretFieldNames = {
  input: "refreshToken",
  encrypted: "encryptedRefreshToken",
  iv: "refreshTokenIv",
  tag: "refreshTokenTag",
  hint: "refreshTokenHint"
};

function assertProvider(value: unknown): asserts value is ModelProvider {
  if (typeof value !== "string" || !knownProviderValues.has(value as ModelProvider)) {
    throw new Error("Invalid model provider");
  }
}

function assertUrl(value: string, fieldName: string) {
  if (!value) return;

  try {
    const parsed = new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("Invalid protocol");
    }
  } catch {
    throw new Error(`${fieldName} must be a valid URL`);
  }
}

function stringValue(value: unknown) {
  return String(value ?? "").trim();
}

/**
 * Spring Authorization Server (used by COROS) rejects `localhost` as a redirect_uri host and
 * requires the loopback IP literal `127.0.0.1` instead. Rewrite the host so the OAuth redirect_uri
 * is accepted on the post-login authorize leg; other hosts are returned unchanged.
 */
function toLoopbackOrigin(origin: string): string {
  try {
    const url = new URL(origin);
    if (url.hostname === "localhost") {
      url.hostname = "127.0.0.1";
    }
    return url.origin;
  } catch {
    return origin;
  }
}

function authType(value: unknown): DataMcpAuthType {
  return typeof value === "string" && knownAuthTypes.has(value as DataMcpAuthType) ? (value as DataMcpAuthType) : "none";
}

function dataMcpTransport(value: unknown, fallback: DataMcpTransport = "http"): DataMcpTransport {
  return typeof value === "string" && knownDataMcpTransports.has(value as DataMcpTransport)
    ? (value as DataMcpTransport)
    : fallback;
}

function corosRegionValue(value: unknown): CorosMcpRegion | undefined {
  return typeof value === "string" && knownCorosRegions.has(value as CorosMcpRegion) ? (value as CorosMcpRegion) : undefined;
}

function oauthReturnTargetValue(value: unknown): OAuthReturnTarget | undefined {
  return value === "app" || value === "web" ? value : undefined;
}

function cloneDefaultConnections() {
  return defaultDataMcpConnections.map((connection) => ({
    ...connection,
    auth: { ...connection.auth }
  }));
}

function copyExistingSecret(existing: DataMcpAuthConfig | undefined, names: SecretFieldNames): Partial<DataMcpAuthConfig> {
  const encrypted = existing?.[names.encrypted];
  const iv = existing?.[names.iv];
  const tag = existing?.[names.tag];

  if (typeof encrypted !== "string" || typeof iv !== "string" || typeof tag !== "string") {
    return {};
  }

  return {
    [names.encrypted]: encrypted,
    [names.iv]: iv,
    [names.tag]: tag,
    [names.hint]: typeof existing?.[names.hint] === "string" ? existing[names.hint] : undefined
  } as Partial<DataMcpAuthConfig>;
}

function encryptedSecretPatch(input: DataMcpAuthConfig | undefined, existing: DataMcpAuthConfig | undefined, names: SecretFieldNames) {
  const plaintext = stringValue(input?.[names.input]);

  if (!plaintext) {
    const existingSecret = copyExistingSecret(existing, names);
    return Object.keys(existingSecret).length > 0 ? existingSecret : copyExistingSecret(input, names);
  }

  const encrypted = encryptSecret(plaintext);
  return {
    [names.encrypted]: encrypted.encryptedApiKey,
    [names.iv]: encrypted.apiKeyIv,
    [names.tag]: encrypted.apiKeyTag,
    [names.hint]: encrypted.apiKeyHint
  } as Partial<DataMcpAuthConfig>;
}

function sanitizeSecret(auth: DataMcpAuthConfig, names: SecretFieldNames): Partial<DataMcpAuthConfig> {
  const hint = auth[names.hint];
  return typeof hint === "string" && hint ? ({ [names.hint]: hint } as Partial<DataMcpAuthConfig>) : {};
}

function decryptStoredSecret(auth: DataMcpAuthConfig, names: SecretFieldNames): string | null {
  const encrypted = auth[names.encrypted];
  const iv = auth[names.iv];
  const tag = auth[names.tag];

  if (typeof encrypted !== "string" || typeof iv !== "string" || typeof tag !== "string") {
    return null;
  }

  return decryptSecret({
    encryptedApiKey: encrypted,
    apiKeyIv: iv,
    apiKeyTag: tag
  });
}

function encryptedLarkSessionPatch(input: DataMcpConnection, existing?: DataMcpConnection): Partial<DataMcpConnection> {
  const plaintext = stringValue(input.larkSession);
  if (plaintext) {
    const encrypted = encryptSecret(plaintext);
    return {
      encryptedLarkSession: encrypted.encryptedApiKey,
      larkSessionIv: encrypted.apiKeyIv,
      larkSessionTag: encrypted.apiKeyTag,
      larkSessionHint: encrypted.apiKeyHint
    };
  }

  if (existing?.encryptedLarkSession && existing.larkSessionIv && existing.larkSessionTag) {
    return {
      encryptedLarkSession: existing.encryptedLarkSession,
      larkSessionIv: existing.larkSessionIv,
      larkSessionTag: existing.larkSessionTag,
      larkSessionHint: existing.larkSessionHint
    };
  }

  if (input.encryptedLarkSession && input.larkSessionIv && input.larkSessionTag) {
    return {
      encryptedLarkSession: input.encryptedLarkSession,
      larkSessionIv: input.larkSessionIv,
      larkSessionTag: input.larkSessionTag,
      larkSessionHint: input.larkSessionHint
    };
  }

  return {};
}

function decryptLarkSession(connection: DataMcpConnection): string | null {
  if (!connection.encryptedLarkSession || !connection.larkSessionIv || !connection.larkSessionTag) return null;
  return decryptSecret({
    encryptedApiKey: connection.encryptedLarkSession,
    apiKeyIv: connection.larkSessionIv,
    apiKeyTag: connection.larkSessionTag
  });
}

function normalizeAuth(input: DataMcpAuthConfig | undefined, existing?: DataMcpAuthConfig): DataMcpAuthConfig {
  const type = authType(input?.type ?? existing?.type);

  if (type === "bearer") {
    return {
      type,
      ...encryptedSecretPatch(input, existing, tokenFields)
    };
  }

  if (type === "api_key") {
    return {
      type,
      headerName: stringValue(input?.headerName || existing?.headerName || "x-api-key"),
      ...encryptedSecretPatch(input, existing, apiKeyFields)
    };
  }

  if (type === "basic") {
    return {
      type,
      username: stringValue(input?.username ?? existing?.username),
      ...encryptedSecretPatch(input, existing, passwordFields)
    };
  }

  if (type === "oauth2") {
    const authorizeUrl = stringValue(input?.authorizeUrl ?? existing?.authorizeUrl);
    const tokenUrl = stringValue(input?.tokenUrl ?? existing?.tokenUrl);
    assertUrl(authorizeUrl, "OAuth authorize URL");
    assertUrl(tokenUrl, "OAuth token URL");

    return {
      type,
      authorizeUrl,
      tokenUrl,
      clientId: stringValue(input?.clientId ?? existing?.clientId),
      scopes: stringValue(input?.scopes ?? existing?.scopes),
      expiresAt: stringValue(input?.expiresAt ?? existing?.expiresAt) || undefined,
      oauthState: stringValue(input?.oauthState ?? existing?.oauthState) || undefined,
      oauthCodeVerifier: stringValue(input?.oauthCodeVerifier ?? existing?.oauthCodeVerifier) || undefined,
      oauthReturnOrigin: stringValue(input?.oauthReturnOrigin ?? existing?.oauthReturnOrigin) || undefined,
      oauthRegisteredRedirectUri:
        stringValue(input?.oauthRegisteredRedirectUri ?? existing?.oauthRegisteredRedirectUri) || undefined,
      oauthReturnTarget: oauthReturnTargetValue(input?.oauthReturnTarget ?? existing?.oauthReturnTarget),
      corosOAuthRegistrationVersion:
        typeof input?.corosOAuthRegistrationVersion === "number"
          ? input.corosOAuthRegistrationVersion
          : typeof existing?.corosOAuthRegistrationVersion === "number"
            ? existing.corosOAuthRegistrationVersion
            : undefined,
      ...encryptedSecretPatch(input, existing, clientSecretFields),
      ...encryptedSecretPatch(input, existing, accessTokenFields),
      ...encryptedSecretPatch(input, existing, refreshTokenFields)
    };
  }

  return { type: "none" };
}

function sanitizeAuth(auth: DataMcpAuthConfig | undefined): DataMcpAuthConfig {
  const type = authType(auth?.type);

  if (type === "bearer") {
    return {
      type,
      ...sanitizeSecret(auth ?? { type }, tokenFields)
    };
  }

  if (type === "api_key") {
    return {
      type,
      headerName: stringValue(auth?.headerName || "x-api-key"),
      ...sanitizeSecret(auth ?? { type }, apiKeyFields)
    };
  }

  if (type === "basic") {
    return {
      type,
      username: stringValue(auth?.username),
      ...sanitizeSecret(auth ?? { type }, passwordFields)
    };
  }

  if (type === "oauth2") {
    return {
      type,
      authorizeUrl: stringValue(auth?.authorizeUrl),
      tokenUrl: stringValue(auth?.tokenUrl),
      clientId: stringValue(auth?.clientId),
      scopes: stringValue(auth?.scopes),
      expiresAt: stringValue(auth?.expiresAt) || undefined,
      oauthRegisteredRedirectUri: stringValue(auth?.oauthRegisteredRedirectUri) || undefined,
      corosOAuthRegistrationVersion:
        typeof auth?.corosOAuthRegistrationVersion === "number" ? auth.corosOAuthRegistrationVersion : undefined,
      ...sanitizeSecret(auth ?? { type }, clientSecretFields),
      ...sanitizeSecret(auth ?? { type }, accessTokenFields),
      ...sanitizeSecret(auth ?? { type }, refreshTokenFields)
    };
  }

  return { type: "none" };
}

function normalizeConnection(input: DataMcpConnection, existing?: DataMcpConnection): DataMcpConnection {
  if (!knownConnectionIds.has(input.id)) {
    throw new Error("Invalid MCP connection");
  }

  const base = defaultDataMcpConnections.find((connection) => connection.id === input.id);
  if (!base) throw new Error("Invalid MCP connection");

  const endpoint = stringValue(input.endpoint);
  assertUrl(endpoint, `${base.label} endpoint`);
  const loginUrl = stringValue(input.loginUrl);
  assertUrl(loginUrl, `${base.label} login URL`);
  const corosRegion = base.id === "coros" ? corosRegionValue(input.corosRegion) : undefined;
  const transport = base.id === "meal_menu" ? dataMcpTransport(input.transport, base.transport ?? "http") : "http";

  return {
    id: base.id,
    label: base.label,
    enabled: Boolean(input.enabled),
    serverName: stringValue(input.serverName),
    capabilityName: stringValue(input.capabilityName),
    transport,
    endpoint,
    command: stringValue(input.command ?? base.command),
    args: stringValue(input.args ?? base.args),
    canteenName: stringValue(input.canteenName),
    ...encryptedLarkSessionPatch(input, existing),
    auth: normalizeAuth(input.auth, existing?.auth),
    loginUrl,
    ...(corosRegion ? { corosRegion } : {}),
    notes: stringValue(input.notes)
};
}

function sanitizeConnection(connection: DataMcpConnection): DataMcpConnection {
  const { encryptedLarkSession, larkSessionIv, larkSessionTag, larkSession, ...safeConnection } = connection;
  return {
    ...safeConnection,
    auth: sanitizeAuth(connection.auth)
  };
}

function normalizeConnections(input: unknown, existingConnections: DataMcpConnection[] = cloneDefaultConnections()): DataMcpConnection[] {
  if (!Array.isArray(input)) return cloneDefaultConnections();

  return defaultDataMcpConnections.map((defaultConnection) => {
    const override = input.find((item) => item?.id === defaultConnection.id);
    const existing = existingConnections.find((item) => item.id === defaultConnection.id);
    return normalizeConnection({ ...defaultConnection, ...(override ?? {}) }, existing);
  });
}

function parseStoredConnections(json: string | null | undefined): DataMcpConnection[] {
  try {
    return normalizeConnections(JSON.parse(json || "[]"));
  } catch {
    return cloneDefaultConnections();
  }
}

function parseSanitizedConnections(json: string | null | undefined): DataMcpConnection[] {
  return parseStoredConnections(json).map(sanitizeConnection);
}

/**
 * Resolves the model identity for a provider. Known providers ignore whatever
 * is stored or submitted and always report the current default, which is what
 * lets a `defaultModel` bump reach existing accounts. Only `custom` keeps
 * user-supplied values.
 */
function resolveModelIdentity(
  provider: ModelProvider,
  supplied: { modelName?: string | null; modelBaseUrl?: string | null }
): { modelName: string; modelBaseUrl: string } {
  if (!providerNeedsManualModel(provider)) return resolveProviderModelDefaults(provider);

  const modelName = stringValue(supplied.modelName ?? "");
  if (!modelName) throw new Error("Model name is required");

  const modelBaseUrl = stringValue(supplied.modelBaseUrl ?? "");
  if (!modelBaseUrl) throw new Error("Model base URL is required");
  assertUrl(modelBaseUrl, "Model base URL");

  return { modelName, modelBaseUrl };
}

function toSettingsView(record: SettingsRecord | null): SettingsView {
  if (!record) return { ...defaultSettingsView, dataMcpConnections: cloneDefaultConnections().map(sanitizeConnection) };

  const provider = knownProviderValues.has(record.modelProvider as ModelProvider)
    ? (record.modelProvider as ModelProvider)
    : defaultSettingsView.modelProvider;

  const identity = providerNeedsManualModel(provider)
    ? { modelName: record.modelName || "", modelBaseUrl: record.modelBaseUrl ?? "" }
    : resolveProviderModelDefaults(provider);

  return {
    modelProvider: provider,
    ...identity,
    hasApiKey: Boolean(record.encryptedApiKey && record.apiKeyIv && record.apiKeyTag),
    apiKeyHint: record.apiKeyHint,
    dataMcpConnections: parseSanitizedConnections(record.dataMcpConnectionsJson)
  };
}

function toDraftSettingsRecord(record: SettingsRecord | null, draft: SettingsTestDraftInput): SettingsRecord {
  const baseView = toSettingsView(record);
  const provider = draft.modelProvider ?? baseView.modelProvider;
  assertProvider(provider);

  const keepsCustom = providerNeedsManualModel(provider) && providerNeedsManualModel(baseView.modelProvider);
  const { modelName, modelBaseUrl } = resolveModelIdentity(provider, {
    modelName: draft.modelName ?? (keepsCustom ? baseView.modelName : ""),
    modelBaseUrl: draft.modelBaseUrl ?? (keepsCustom ? baseView.modelBaseUrl : "")
  });

  const trimmedApiKey = stringValue(draft.apiKey);
  const encrypted = trimmedApiKey
    ? encryptApiKey(trimmedApiKey)
    : {
        encryptedApiKey: record?.encryptedApiKey ?? null,
        apiKeyIv: record?.apiKeyIv ?? null,
        apiKeyTag: record?.apiKeyTag ?? null,
        apiKeyHint: record?.apiKeyHint ?? null
      };

  const existingConnections = parseStoredConnections(record?.dataMcpConnectionsJson);

  return {
    modelProvider: provider,
    modelName,
    modelBaseUrl: modelBaseUrl || null,
    encryptedApiKey: encrypted.encryptedApiKey,
    apiKeyIv: encrypted.apiKeyIv,
    apiKeyTag: encrypted.apiKeyTag,
    apiKeyHint: encrypted.apiKeyHint,
    dataMcpConnectionsJson: JSON.stringify(normalizeConnections(draft.dataMcpConnections ?? baseView.dataMcpConnections, existingConnections))
  };
}

export async function loadUserSettings(userId: string): Promise<SettingsView> {
  const record = await prisma.userSettings.findUnique({ where: { userId } });
  return toSettingsView(record);
}

export async function saveUserSettings(userId: string, input: SettingsSaveInput): Promise<SettingsView> {
  assertProvider(input.modelProvider);

  const existing = await prisma.userSettings.findUnique({ where: { userId } });
  const existingView = toSettingsView(existing);
  // Carry the stored custom endpoint forward only when the user was already on
  // `custom`; switching in from a known provider must not inherit its URL.
  const keepsCustom = providerNeedsManualModel(input.modelProvider) && providerNeedsManualModel(existingView.modelProvider);
  const { modelName, modelBaseUrl } = resolveModelIdentity(input.modelProvider, {
    modelName: input.modelName ?? (keepsCustom ? existingView.modelName : ""),
    modelBaseUrl: input.modelBaseUrl ?? (keepsCustom ? existingView.modelBaseUrl : "")
  });

  const existingConnections = parseStoredConnections(existing?.dataMcpConnectionsJson);
  const connections = normalizeConnections(input.dataMcpConnections, existingConnections);
  const trimmedApiKey = stringValue(input.apiKey);
  const encrypted = trimmedApiKey
    ? encryptApiKey(trimmedApiKey)
    : {
        encryptedApiKey: existing?.encryptedApiKey ?? null,
        apiKeyIv: existing?.apiKeyIv ?? null,
        apiKeyTag: existing?.apiKeyTag ?? null,
        apiKeyHint: existing?.apiKeyHint ?? null
      };

  const data = {
    modelProvider: input.modelProvider,
    modelName,
    modelBaseUrl: modelBaseUrl || null,
    encryptedApiKey: encrypted.encryptedApiKey,
    apiKeyIv: encrypted.apiKeyIv,
    apiKeyTag: encrypted.apiKeyTag,
    apiKeyHint: encrypted.apiKeyHint,
    dataMcpConnectionsJson: JSON.stringify(connections)
  };

  await prisma.userSettings.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data
  });

  return toSettingsView({
    ...data,
    modelBaseUrl: data.modelBaseUrl,
    dataMcpConnectionsJson: data.dataMcpConnectionsJson
  });
}

function getProviderBaseUrl(provider: ModelProvider, configuredBaseUrl: string) {
  if (configuredBaseUrl) return configuredBaseUrl.replace(/\/$/, "");
  return modelProviders.find((item) => item.value === provider)?.defaultBaseUrl.replace(/\/$/, "") ?? "";
}

function getProviderLabel(provider: ModelProvider) {
  return modelProviders.find((item) => item.value === provider)?.label ?? "Model provider";
}

function toModelRuntimeConfig(record: SettingsRecord | null): ModelRuntimeConfig | null {
  if (!record?.encryptedApiKey || !record.apiKeyIv || !record.apiKeyTag) return null;

  const view = toSettingsView(record);
  const baseUrl = getProviderBaseUrl(view.modelProvider, view.modelBaseUrl);
  if (!baseUrl) return null;

  return {
    provider: view.modelProvider,
    providerLabel: getProviderLabel(view.modelProvider),
    modelName: view.modelName,
    baseUrl,
    apiKey: decryptApiKey({
      encryptedApiKey: record.encryptedApiKey,
      apiKeyIv: record.apiKeyIv,
      apiKeyTag: record.apiKeyTag
    })
  };
}

export async function loadModelRuntimeConfig(userId: string): Promise<ModelRuntimeConfig | null> {
  const record = await prisma.userSettings.findUnique({ where: { userId } });
  return toModelRuntimeConfig(record);
}

function statusMessage(status: number, provider?: ModelProvider) {
  if (status === 401 || status === 403) {
    const source = provider ? getProviderCredentialSource(provider) : "";
    return source ? `Authentication failed. ${source}` : "Authentication failed. Check the API key.";
  }
  if (status === 404) return "Endpoint or model was not found.";
  return `Provider returned HTTP ${status}.`;
}

async function withLatency(run: () => Promise<Omit<SettingsTestResult, "latencyMs"> | SettingsTestResult>): Promise<SettingsTestResult> {
  const start = Date.now();
  const result = await run();
  if ("latencyMs" in result) return result;
  return { ...result, latencyMs: Date.now() - start };
}

async function testModel(record: SettingsRecord | null): Promise<SettingsTestResult> {
  const view = toSettingsView(record);
  const label = "Model runtime";

  if (!record?.encryptedApiKey || !record.apiKeyIv || !record.apiKeyTag) {
    return { id: "model", label, status: "not_configured", message: "API key is not configured.", latencyMs: null };
  }

  return withLatency(async () => {
    try {
      const apiKey = decryptApiKey({
        encryptedApiKey: record.encryptedApiKey as string,
        apiKeyIv: record.apiKeyIv as string,
        apiKeyTag: record.apiKeyTag as string
      });
      const baseUrl = getProviderBaseUrl(view.modelProvider, view.modelBaseUrl);
      const providerLabel = getProviderLabel(view.modelProvider);

      if (!baseUrl) {
        return { id: "model", label, status: "not_configured", message: `${providerLabel} provider needs a base URL.` };
      }

      if (view.modelProvider === "anthropic") {
        const response = await fetch(`${baseUrl}/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01"
          },
          body: JSON.stringify({
            model: view.modelName,
            max_tokens: 1,
            messages: [{ role: "user", content: "ping" }]
          })
        });
        return response.ok
          ? { id: "model", label, status: "connected", message: `Anthropic model ${view.modelName} responded.` }
          : { id: "model", label, status: "failed", message: statusMessage(response.status, view.modelProvider) };
      }

      // MiniMax uses a different endpoint path
      const endpoint = view.modelProvider === "minimax" ? "/text/chatcompletion_v2" : "/chat/completions";

      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: view.modelName,
          max_tokens: 1,
          messages: [{ role: "user", content: "ping" }]
        })
      });
      return response.ok
        ? { id: "model", label, status: "connected", message: `${providerLabel} model ${view.modelName} responded.` }
        : { id: "model", label, status: "failed", message: statusMessage(response.status, view.modelProvider) };
    } catch (error) {
      return {
        id: "model",
        label,
        status: "failed",
        message: error instanceof Error ? error.message : "Model test failed."
      };
    }
  });
}

function buildMcpAuthHeaders(auth: DataMcpAuthConfig): Record<string, string> | null {
  if (auth.type === "none") return {};

  if (auth.type === "bearer") {
    const token = decryptStoredSecret(auth, tokenFields);
    return token ? { Authorization: `Bearer ${token}` } : null;
  }

  if (auth.type === "api_key") {
    const apiKey = decryptStoredSecret(auth, apiKeyFields);
    return apiKey ? { [stringValue(auth.headerName || "x-api-key")]: apiKey } : null;
  }

  if (auth.type === "basic") {
    const password = decryptStoredSecret(auth, passwordFields);
    if (!password || !auth.username) return null;
    return { Authorization: `Basic ${Buffer.from(`${auth.username}:${password}`).toString("base64")}` };
  }

  if (auth.type === "oauth2") {
    const token = decryptStoredSecret(auth, accessTokenFields);
    return token ? { Authorization: `Bearer ${token}` } : null;
  }

  return {};
}

export async function loadDataMcpConnection(userId: string, connectionId: DataMcpConnectionId): Promise<DataMcpConnection | null> {
  const record = await prisma.userSettings.findUnique({ where: { userId } });
  const connections = parseStoredConnections(record?.dataMcpConnectionsJson);
  return connections.find((connection) => connection.id === connectionId) ?? null;
}

export function buildDataMcpAuthHeaders(connection: DataMcpConnection): Record<string, string> | null {
  return buildMcpAuthHeaders(connection.auth);
}

export function buildDataMcpStdioEnv(connection: DataMcpConnection): Record<string, string> | null {
  const larkSession = stringValue(connection.larkSession) || decryptLarkSession(connection);
  if (!larkSession) return null;
  return { LARK_SESSION: larkSession };
}

function mcpLoginRequiredResult(connection: DataMcpConnection): SettingsTestResult {
  return {
    id: connection.id,
    label: connection.label,
    status: "auth_required",
    message: `${connection.label} login is required before this MCP connection can be tested.`,
    latencyMs: null
  };
}

function parseMcpTestResponse(contentType: string, text: string): { error?: { code?: number; message?: string }; result?: unknown } | null {
  if (!text) return null;

  if (contentType.includes("text/event-stream")) {
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.startsWith("data:") ? line.slice(5).trim() : "";
      if (!trimmed) continue;
      try {
        const parsed = JSON.parse(trimmed) as { error?: { code?: number; message?: string }; result?: unknown };
        if ("result" in parsed || "error" in parsed) return parsed;
      } catch {
        // Ignore keepalives and non-JSON SSE comments.
      }
    }
    return null;
  }

  return JSON.parse(text) as { error?: { code?: number; message?: string }; result?: unknown };
}

async function testMcpConnection(connection: DataMcpConnection): Promise<SettingsTestResult> {
  if (!connection.enabled) {
    return {
      id: connection.id,
      label: connection.label,
      status: "not_configured",
      message: "Connection is disabled.",
      latencyMs: null
    };
  }

  if (!connection.serverName || !connection.capabilityName) {
    return {
      id: connection.id,
      label: connection.label,
      status: "not_configured",
      message: "Server name and capability are required.",
      latencyMs: null
    };
  }

  if (connection.transport === "stdio") {
    if (!connection.command) {
      return {
        id: connection.id,
        label: connection.label,
        status: "not_configured",
        message: "Local MCP command is required.",
        latencyMs: null
      };
    }

    if (!buildDataMcpStdioEnv(connection)) {
      return {
        id: connection.id,
        label: connection.label,
        status: "auth_required",
        message: `${connection.label} LARK_SESSION is required before the local MCP command can be tested.`,
        latencyMs: null
      };
    }

    return {
      id: connection.id,
      label: connection.label,
      status: "connected",
      message: `${connection.command} ${connection.args ?? ""}`.trim() + " is configured.",
      latencyMs: null
    };
  }

  if (!connection.endpoint) {
    return {
      id: connection.id,
      label: connection.label,
      status: "connected",
      message: `${connection.serverName}/${connection.capabilityName} descriptor is configured.`,
      latencyMs: null
    };
  }

  const headers = buildMcpAuthHeaders(connection.auth);
  if (!headers) {
    return mcpLoginRequiredResult(connection);
  }

  return withLatency(async () => {
    try {
      const response = await fetch(connection.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          ...headers
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-06-18",
            capabilities: {},
            clientInfo: {
              name: "healthy-body-manager",
              version: "0.1.0"
            }
          }
        })
      });
      if (response.ok) {
        const result = parseMcpTestResponse(response.headers.get("content-type") ?? "", await response.text());
        if (result?.error) {
          return {
            id: connection.id,
            label: connection.label,
            status: "failed",
            message: `MCP error${result.error.code ? ` ${result.error.code}` : ""}: ${result.error.message ?? "Unknown error"}`
          };
        }
        return { id: connection.id, label: connection.label, status: "connected", message: `MCP endpoint initialized with HTTP ${response.status}.` };
      }
      if (response.status === 401 || response.status === 403) {
        return mcpLoginRequiredResult(connection);
      }
      if (response.status === 401 || response.status === 403) {
        return mcpLoginRequiredResult(connection);
      }
      return {
        id: connection.id,
        label: connection.label,
        status: "failed",
        message: `Endpoint returned HTTP ${response.status}.`
      };
    } catch (error) {
      return {
        id: connection.id,
        label: connection.label,
        status: "failed",
        message: error instanceof Error ? error.message : "MCP endpoint test failed."
      };
    }
  });
}

export async function testUserSettings(
  userId: string,
  target: SettingsTestTarget,
  draft?: SettingsTestDraftInput
): Promise<SettingsTestResult[]> {
  if (!["model", "coros", "calendar", "meal_menu", "all"].includes(target)) {
    throw new Error("Invalid settings test target");
  }

  const record = await prisma.userSettings.findUnique({ where: { userId } });
  const settingsRecord = draft ? toDraftSettingsRecord(record, draft) : record;
  const storedConnections = parseStoredConnections(settingsRecord?.dataMcpConnectionsJson);

  if (target === "model") return [await testModel(settingsRecord)];

  const enabledConnectionTests = storedConnections.filter((connection) => connection.enabled).map((connection) => testMcpConnection(connection));

  if (target === "all") {
    return [await testModel(settingsRecord), ...(await Promise.all(enabledConnectionTests))];
  }

  const connection = storedConnections.find((item) => item.id === target);
  if (!connection) throw new Error("Invalid settings test target");
  return [await testMcpConnection(connection)];
}

async function persistConnections(userId: string, record: SettingsRecord, connections: DataMcpConnection[]) {
  const data = {
    modelProvider: record.modelProvider || defaultSettingsView.modelProvider,
    modelName: record.modelName || defaultSettingsView.modelName,
    modelBaseUrl: record.modelBaseUrl || defaultSettingsView.modelBaseUrl,
    encryptedApiKey: record.encryptedApiKey ?? null,
    apiKeyIv: record.apiKeyIv ?? null,
    apiKeyTag: record.apiKeyTag ?? null,
    apiKeyHint: record.apiKeyHint ?? null,
    dataMcpConnectionsJson: JSON.stringify(connections)
  };

  await prisma.userSettings.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data
  });
}

const officialCorosMcpBaseUrls = new Set(corosMcpRegionOptions.map((option) => option.url.replace(/\/$/, "")));

/**
 * Persist COROS MCP endpoint/region before OAuth redirect without touching `auth`.
 * Full `saveUserSettings` from the Settings form often sends `auth: { type: "none" }`, which would
 * wipe an in-progress OAuth2 registration and break COROS "state" validation on the login page.
 */
export async function prepareCorosMcpConnectionForOAuth(
  userId: string,
  input: { endpoint?: string; corosRegion?: CorosMcpRegion }
): Promise<void> {
  const explicitRegion = input.corosRegion !== undefined ? corosRegionValue(input.corosRegion) : undefined;
  const requestedEndpoint = stringValue(input.endpoint).replace(/\/$/, "");
  // The region determines the host, so a client that picked one does not have to
  // know or send the URL. An explicit endpoint still wins for the web form.
  const requestedOrRegional = requestedEndpoint || (explicitRegion ? corosMcpUrlByRegion[explicitRegion] : "");
  if (requestedOrRegional && !officialCorosMcpBaseUrls.has(requestedOrRegional)) {
    throw new Error("COROS endpoint must be one of the official regional MCP URLs.");
  }

  let record = await prisma.userSettings.findUnique({ where: { userId } });
  if (!record) {
    await prisma.userSettings.create({
      data: {
        userId,
        modelProvider: defaultSettingsView.modelProvider,
        modelName: defaultSettingsView.modelName,
        modelBaseUrl: defaultSettingsView.modelBaseUrl || null,
        encryptedApiKey: null,
        apiKeyIv: null,
        apiKeyTag: null,
        apiKeyHint: null,
        dataMcpConnectionsJson: JSON.stringify(cloneDefaultConnections())
      }
    });
    record = await prisma.userSettings.findUnique({ where: { userId } });
  }
  if (!record) throw new Error("Could not prepare user settings.");

  const connections = parseStoredConnections(record.dataMcpConnectionsJson);
  const connection = connections.find((item) => item.id === "coros");
  if (!connection) throw new Error("COROS MCP connection is missing.");

  const region = explicitRegion ?? connection.corosRegion;
  const normalizedEndpoint =
    requestedOrRegional || (region ? corosMcpUrlByRegion[region] : "") || stringValue(connection.endpoint).replace(/\/$/, "");

  if (!officialCorosMcpBaseUrls.has(normalizedEndpoint)) {
    throw new Error("COROS endpoint must be one of the official regional MCP URLs.");
  }

  const updated: DataMcpConnection = {
    ...connection,
    endpoint: normalizedEndpoint,
    ...(region ? { corosRegion: region } : {}),
    serverName: "coros",
    capabilityName: "daily-health"
  };

  const next = connections.map((item) => (item.id === "coros" ? updated : item));
  await persistConnections(userId, record, next);
}

export async function createMcpOAuthAuthorizationUrl(
  userId: string,
  connectionId: DataMcpConnectionId,
  origin: string,
  returnTarget: OAuthReturnTarget = "web"
): Promise<URL> {
  const record = await prisma.userSettings.findUnique({ where: { userId } });
  if (!record) throw new Error("Save MCP settings before starting OAuth login.");

  const connections = parseStoredConnections(record.dataMcpConnectionsJson);
  const connection = connections.find((item) => item.id === connectionId);
  if (!connection) throw new Error("Invalid MCP connection");

  const appOrigin = new URL(origin).origin;
  // The browser must land the callback on a host COROS accepts as a redirect (not `localhost`).
  const callbackOrigin = toLoopbackOrigin(appOrigin);
  const redirectUri = `${callbackOrigin}/api/settings/mcp/oauth/callback`;

  let corosDiscovery: Awaited<ReturnType<typeof discoverCorosMcpOAuthEndpoints>> = null;

  // For COROS, try MCP / OAuth metadata discovery before requiring pre-configured OAuth2 URLs
  if (connectionId === "coros") {
    corosDiscovery = await discoverCorosMcpOAuthEndpoints(connection);

    if (corosDiscovery) {
      connection.auth = {
        ...connection.auth,
        type: "oauth2",
        authorizeUrl: corosDiscovery.authorizeUrl,
        tokenUrl: corosDiscovery.tokenUrl
      };
      await persistConnections(userId, record, connections);
    } else if (connection.auth.type !== "oauth2" || !connection.auth.authorizeUrl || !connection.auth.tokenUrl) {
      throw new Error(
        "COROS MCP OAuth auto-discovery is not supported by this server yet. " +
        "In settings, set Auth type to OAuth2 and fill in Authorize URL, Token URL, and Client ID manually, " +
        "or set a Login URL to open COROS in a new tab."
      );
    }
  }

  if (connection.auth.type !== "oauth2") throw new Error("MCP connection is not configured for OAuth2.");

  const { authorizeUrl, tokenUrl } = connection.auth;
  let clientId = stringValue(connection.auth.clientId);
  let scopes = stringValue(connection.auth.scopes);

  if (!authorizeUrl || !tokenUrl) {
    throw new Error("OAuth authorize URL and token URL are required. Set Auth type to OAuth2 and fill in the fields.");
  }

  if (connectionId === "coros") {
    const registrationEndpoint = corosDiscovery?.registrationEndpoint;
    const registeredFor = stringValue(connection.auth.oauthRegisteredRedirectUri);
    const regVer = connection.auth.corosOAuthRegistrationVersion;
    // The client must be (re)registered for the exact redirect_uri and current registration shape.
    // A stored client without these markers (or registered for a different host, e.g. an old
    // `localhost` redirect) makes COROS reject the post-login authorize leg with a 400, so register
    // a fresh one whenever dynamic registration is available and the existing client is unverified.
    const registeredForCurrent = registeredFor === redirectUri && regVer === COROS_OAUTH_REGISTRATION_VERSION;
    if (registrationEndpoint && (!stringValue(clientId) || !registeredForCurrent)) {
      const registered = await registerCorosOAuthClient(registrationEndpoint, redirectUri);
      clientId = registered.clientId;
      connection.auth.clientId = clientId;
      connection.auth.oauthRegisteredRedirectUri = redirectUri;
      connection.auth.corosOAuthRegistrationVersion = COROS_OAUTH_REGISTRATION_VERSION;
      await persistConnections(userId, record, connections);
    }
  }

  if (!stringValue(clientId)) {
    throw new Error(
      "OAuth client ID is required. For official COROS MCP endpoints this should register automatically; otherwise add Client ID in the connection settings."
    );
  }

  if (connectionId === "coros" && !stringValue(scopes)) {
    scopes = COROS_OAUTH_DEFAULT_SCOPES;
    connection.auth.scopes = scopes;
  }

  const state = randomBytes(18).toString("hex");
  connection.auth.oauthState = state;
  // Remember where the user started so the callback (which lands on the loopback origin) can send
  // them back to their original session origin.
  connection.auth.oauthReturnOrigin = appOrigin;
  connection.auth.oauthReturnTarget = returnTarget;

  let corosPkce: { verifier: string; challenge: string } | null = null;
  if (connectionId === "coros") {
    corosPkce = createOAuthPkceS256Pair();
    connection.auth.oauthCodeVerifier = corosPkce.verifier;
  } else {
    connection.auth.oauthCodeVerifier = undefined;
  }

  await persistConnections(userId, record, connections);

  const url = new URL(authorizeUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", stringValue(clientId));
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  if (scopes) url.searchParams.set("scope", scopes);
  if (corosPkce) {
    url.searchParams.set("code_challenge", corosPkce.challenge);
    url.searchParams.set("code_challenge_method", "S256");
  }
  // RFC 8707 Resource Indicators: MCP authorization requires the canonical MCP server URI so the
  // authorization server can bind the issued token's audience. Omitting it makes COROS reject the
  // post-login `login_ticket` authorize leg with a 400 Bad Request.
  const resource = stringValue(connection.endpoint).replace(/\/$/, "");
  if (resource) url.searchParams.set("resource", resource);
  return url;
}

export async function handleMcpOAuthCallback(
  userId: string,
  input: { code: string; state: string; origin: string }
): Promise<DataMcpConnectionId> {
  const record = await prisma.userSettings.findUnique({ where: { userId } });
  if (!record) throw new Error("MCP settings were not found.");

  const connections = parseStoredConnections(record.dataMcpConnectionsJson);
  const connection = connections.find((item) => item.auth.type === "oauth2" && item.auth.oauthState === input.state);
  if (!connection) throw new Error("Invalid OAuth state.");

  const { tokenUrl, clientId } = connection.auth;
  if (!tokenUrl || !clientId) throw new Error("OAuth token URL and client ID are required.");

  // Must match the redirect_uri used at authorize time (loopback IP, not localhost).
  const callbackOrigin = toLoopbackOrigin(new URL(input.origin).origin);
  const redirectUri = `${callbackOrigin}/api/settings/mcp/oauth/callback`;
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: redirectUri,
    client_id: stringValue(clientId)
  });
  const codeVerifier = stringValue(connection.auth.oauthCodeVerifier);
  if (codeVerifier) body.set("code_verifier", codeVerifier);
  const clientSecret = decryptStoredSecret(connection.auth, clientSecretFields);
  if (clientSecret) body.set("client_secret", clientSecret);
  // RFC 8707: the token request must carry the same resource indicator used at authorize time.
  const resource = stringValue(connection.endpoint).replace(/\/$/, "");
  if (resource) body.set("resource", resource);

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString()
  });

  if (!response.ok) {
    throw new Error(`OAuth token exchange failed with HTTP ${response.status}.`);
  }

  const tokenBody = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

  if (!tokenBody.access_token) throw new Error("OAuth token response did not include an access token.");

  connection.auth = {
    ...connection.auth,
    oauthState: undefined,
    oauthCodeVerifier: undefined,
    expiresAt:
      typeof tokenBody.expires_in === "number" && Number.isFinite(tokenBody.expires_in)
        ? new Date(Date.now() + tokenBody.expires_in * 1000).toISOString()
        : undefined,
    ...encryptedSecretPatch({ type: "oauth2", accessToken: tokenBody.access_token }, connection.auth, accessTokenFields),
    ...(tokenBody.refresh_token
      ? encryptedSecretPatch({ type: "oauth2", refreshToken: tokenBody.refresh_token }, connection.auth, refreshTokenFields)
      : copyExistingSecret(connection.auth, refreshTokenFields))
  };

  await persistConnections(userId, record, connections);
  return connection.id;
}

/**
 * Resolve the user and original app origin for an in-progress OAuth flow from its `state` token.
 *
 * The OAuth callback lands on the loopback IP origin (127.0.0.1) that COROS accepts as a redirect
 * host, which does not share the session cookie set on the user's browsing origin (localhost). The
 * random `state` is the standard correlation token for the pending authorization, so it is used to
 * identify the user instead of the session.
 */
const APP_OAUTH_RETURN_URL = process.env.HBM_APP_OAUTH_RETURN_URL || "hbm://mcp-oauth";

/**
 * Where the browser is sent once the OAuth dance ends. A native flow returns to
 * the app deep link so the in-app browser dismisses itself and the app can
 * refresh; a web flow returns to the settings page it started from.
 */
export function buildOAuthReturnUrl(
  target: OAuthReturnTarget,
  returnOrigin: string,
  params: Record<string, string>
): string {
  const url = target === "app" ? new URL(APP_OAUTH_RETURN_URL) : new URL("/settings", returnOrigin);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

export async function resolveMcpOAuthState(
  state: string
): Promise<{ userId: string; returnOrigin: string | null; returnTarget: OAuthReturnTarget } | null> {
  const candidate = stringValue(state);
  if (!candidate) return null;

  const records = await prisma.userSettings.findMany();
  for (const record of records) {
    const connections = parseStoredConnections(record.dataMcpConnectionsJson);
    const connection = connections.find(
      (item) => item.auth.type === "oauth2" && item.auth.oauthState === candidate
    );
    if (connection) {
      return {
        userId: record.userId,
        returnOrigin: stringValue(connection.auth.oauthReturnOrigin) || null,
        returnTarget: oauthReturnTargetValue(connection.auth.oauthReturnTarget) ?? "web"
      };
    }
  }

  return null;
}
