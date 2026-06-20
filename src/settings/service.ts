import { randomBytes } from "node:crypto";
import { prisma } from "@/src/db/client";
import { decryptApiKey, decryptSecret, encryptApiKey, encryptSecret } from "@/src/settings/crypto";
import {
  corosMcpRegionOptions,
  defaultDataMcpConnections,
  defaultSettingsView,
  modelProviders,
  type CorosMcpRegion,
  type DataMcpAuthConfig,
  type DataMcpAuthType,
  type DataMcpConnection,
  type DataMcpConnectionId,
  type ModelProvider,
  type SettingsView
} from "@/src/settings/defaults";

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
  modelName: string;
  modelBaseUrl: string;
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
  status: "connected" | "failed" | "not_configured";
  message: string;
  latencyMs: number | null;
};

const knownProviderValues = new Set(modelProviders.map((provider) => provider.value));
const knownConnectionIds = new Set(defaultDataMcpConnections.map((connection) => connection.id));
const knownAuthTypes = new Set<DataMcpAuthType>(["none", "bearer", "api_key", "basic", "oauth2"]);
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

function authType(value: unknown): DataMcpAuthType {
  return typeof value === "string" && knownAuthTypes.has(value as DataMcpAuthType) ? (value as DataMcpAuthType) : "none";
}

function corosRegionValue(value: unknown): CorosMcpRegion | undefined {
  return typeof value === "string" && knownCorosRegions.has(value as CorosMcpRegion) ? (value as CorosMcpRegion) : undefined;
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

  return {
    id: base.id,
    label: base.label,
    enabled: Boolean(input.enabled),
    serverName: stringValue(input.serverName),
    capabilityName: stringValue(input.capabilityName),
    endpoint,
    auth: normalizeAuth(input.auth, existing?.auth),
    ...(loginUrl ? { loginUrl } : {}),
    ...(corosRegion ? { corosRegion } : {}),
    notes: stringValue(input.notes)
  };
}

function sanitizeConnection(connection: DataMcpConnection): DataMcpConnection {
  return {
    ...connection,
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

function toSettingsView(record: SettingsRecord | null): SettingsView {
  if (!record) return { ...defaultSettingsView, dataMcpConnections: cloneDefaultConnections().map(sanitizeConnection) };

  const provider = knownProviderValues.has(record.modelProvider as ModelProvider)
    ? (record.modelProvider as ModelProvider)
    : defaultSettingsView.modelProvider;

  return {
    modelProvider: provider,
    modelName: record.modelName || defaultSettingsView.modelName,
    modelBaseUrl: record.modelBaseUrl ?? "",
    hasApiKey: Boolean(record.encryptedApiKey && record.apiKeyIv && record.apiKeyTag),
    apiKeyHint: record.apiKeyHint,
    dataMcpConnections: parseSanitizedConnections(record.dataMcpConnectionsJson)
  };
}

function toDraftSettingsRecord(record: SettingsRecord | null, draft: SettingsTestDraftInput): SettingsRecord {
  const baseView = toSettingsView(record);
  const provider = draft.modelProvider ?? baseView.modelProvider;
  assertProvider(provider);

  const modelName = stringValue(draft.modelName ?? baseView.modelName);
  if (!modelName) throw new Error("Model name is required");

  const modelBaseUrl = stringValue(draft.modelBaseUrl ?? baseView.modelBaseUrl ?? "");
  assertUrl(modelBaseUrl, "Model base URL");

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

  const modelName = stringValue(input.modelName);
  if (!modelName) throw new Error("Model name is required");

  const modelBaseUrl = stringValue(input.modelBaseUrl);
  assertUrl(modelBaseUrl, "Model base URL");

  const existing = await prisma.userSettings.findUnique({ where: { userId } });
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

function statusMessage(status: number) {
  if (status === 401 || status === 403) return "Authentication failed. Check the API key.";
  if (status === 404) return "Endpoint or model was not found.";
  return `Provider returned HTTP ${status}.`;
}

async function withLatency(run: () => Promise<Omit<SettingsTestResult, "latencyMs">>): Promise<SettingsTestResult> {
  const start = Date.now();
  const result = await run();
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
          : { id: "model", label, status: "failed", message: statusMessage(response.status) };
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
        : { id: "model", label, status: "failed", message: statusMessage(response.status) };
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
    return {
      id: connection.id,
      label: connection.label,
      status: "not_configured",
      message: `${connection.label} authentication is not configured.`,
      latencyMs: null
    };
  }

  return withLatency(async () => {
    try {
      const response = await fetch(connection.endpoint, { method: "GET", headers });
      if (response.ok) {
        return { id: connection.id, label: connection.label, status: "connected", message: `Endpoint responded with HTTP ${response.status}.` };
      }
      return {
        id: connection.id,
        label: connection.label,
        status: "failed",
        message:
          response.status === 401 || response.status === 403
            ? "Authentication failed. Check the MCP credentials."
            : `Endpoint returned HTTP ${response.status}.`
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

export async function createMcpOAuthAuthorizationUrl(userId: string, connectionId: DataMcpConnectionId, origin: string): Promise<URL> {
  const record = await prisma.userSettings.findUnique({ where: { userId } });
  if (!record) throw new Error("Save MCP settings before starting OAuth login.");

  const connections = parseStoredConnections(record.dataMcpConnectionsJson);
  const connection = connections.find((item) => item.id === connectionId);
  if (!connection) throw new Error("Invalid MCP connection");
  if (connection.auth.type !== "oauth2") throw new Error("MCP connection is not configured for OAuth2.");

  const { authorizeUrl, tokenUrl, clientId, scopes } = connection.auth;
  if (!authorizeUrl || !tokenUrl || !clientId) {
    throw new Error("OAuth authorize URL, token URL, and client ID are required.");
  }

  const state = randomBytes(18).toString("hex");
  connection.auth.oauthState = state;
  await persistConnections(userId, record, connections);

  const appOrigin = new URL(origin).origin;
  const redirectUri = `${appOrigin}/api/settings/mcp/oauth/callback`;
  const url = new URL(authorizeUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  if (scopes) url.searchParams.set("scope", scopes);
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

  const appOrigin = new URL(input.origin).origin;
  const redirectUri = `${appOrigin}/api/settings/mcp/oauth/callback`;
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: redirectUri,
    client_id: clientId
  });
  const clientSecret = decryptStoredSecret(connection.auth, clientSecretFields);
  if (clientSecret) body.set("client_secret", clientSecret);

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
