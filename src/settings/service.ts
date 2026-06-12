import { prisma } from "@/src/db/client";
import { decryptApiKey, encryptApiKey } from "@/src/settings/crypto";
import {
  defaultDataMcpConnections,
  defaultSettingsView,
  modelProviders,
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

export type SettingsSaveInput = {
  modelProvider: ModelProvider;
  modelName: string;
  modelBaseUrl: string;
  apiKey?: string;
  dataMcpConnections: DataMcpConnection[];
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

function normalizeConnection(input: DataMcpConnection): DataMcpConnection {
  if (!knownConnectionIds.has(input.id)) {
    throw new Error("Invalid MCP connection");
  }

  const base = defaultDataMcpConnections.find((connection) => connection.id === input.id);
  if (!base) throw new Error("Invalid MCP connection");

  const endpoint = String(input.endpoint ?? "").trim();
  assertUrl(endpoint, `${base.label} endpoint`);

  return {
    id: base.id,
    label: base.label,
    enabled: Boolean(input.enabled),
    serverName: String(input.serverName ?? "").trim(),
    capabilityName: String(input.capabilityName ?? "").trim(),
    endpoint,
    notes: String(input.notes ?? "").trim()
  };
}

function normalizeConnections(input: unknown): DataMcpConnection[] {
  if (!Array.isArray(input)) return defaultDataMcpConnections.map((connection) => ({ ...connection }));

  return defaultDataMcpConnections.map((defaultConnection) => {
    const override = input.find((item) => item?.id === defaultConnection.id);
    return normalizeConnection({ ...defaultConnection, ...(override ?? {}) });
  });
}

function parseConnections(json: string): DataMcpConnection[] {
  try {
    return normalizeConnections(JSON.parse(json));
  } catch {
    return defaultDataMcpConnections.map((connection) => ({ ...connection }));
  }
}

function toSettingsView(record: SettingsRecord | null): SettingsView {
  if (!record) return { ...defaultSettingsView, dataMcpConnections: defaultDataMcpConnections.map((connection) => ({ ...connection })) };

  const provider = knownProviderValues.has(record.modelProvider as ModelProvider)
    ? (record.modelProvider as ModelProvider)
    : defaultSettingsView.modelProvider;

  return {
    modelProvider: provider,
    modelName: record.modelName || defaultSettingsView.modelName,
    modelBaseUrl: record.modelBaseUrl ?? "",
    hasApiKey: Boolean(record.encryptedApiKey && record.apiKeyIv && record.apiKeyTag),
    apiKeyHint: record.apiKeyHint,
    dataMcpConnections: parseConnections(record.dataMcpConnectionsJson)
  };
}

export async function loadUserSettings(userId: string): Promise<SettingsView> {
  const record = await prisma.userSettings.findUnique({ where: { userId } });
  return toSettingsView(record);
}

export async function saveUserSettings(userId: string, input: SettingsSaveInput): Promise<SettingsView> {
  assertProvider(input.modelProvider);

  const modelName = String(input.modelName ?? "").trim();
  if (!modelName) throw new Error("Model name is required");

  const modelBaseUrl = String(input.modelBaseUrl ?? "").trim();
  assertUrl(modelBaseUrl, "Model base URL");

  const connections = normalizeConnections(input.dataMcpConnections);
  const existing = await prisma.userSettings.findUnique({ where: { userId } });
  const trimmedApiKey = String(input.apiKey ?? "").trim();
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

      if (view.modelProvider === "custom") {
        if (!baseUrl) {
          return { id: "model", label, status: "not_configured", message: "Custom provider needs a base URL." };
        }

        const response = await fetch(baseUrl, {
          method: "GET",
          headers: { Authorization: `Bearer ${apiKey}` }
        });
        return response.ok
          ? { id: "model", label, status: "connected", message: `Custom endpoint responded with HTTP ${response.status}.` }
          : { id: "model", label, status: "failed", message: statusMessage(response.status) };
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

      const response = await fetch(`${baseUrl}/chat/completions`, {
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

  return withLatency(async () => {
    try {
      const response = await fetch(connection.endpoint, { method: "GET" });
      return response.ok
        ? { id: connection.id, label: connection.label, status: "connected", message: `Endpoint responded with HTTP ${response.status}.` }
        : { id: connection.id, label: connection.label, status: "failed", message: `Endpoint returned HTTP ${response.status}.` };
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

export async function testUserSettings(userId: string, target: SettingsTestTarget): Promise<SettingsTestResult[]> {
  if (!["model", "coros", "calendar", "meal_menu", "all"].includes(target)) {
    throw new Error("Invalid settings test target");
  }

  const record = await prisma.userSettings.findUnique({ where: { userId } });
  const view = toSettingsView(record);

  if (target === "model") return [await testModel(record)];

  const enabledConnectionTests = view.dataMcpConnections.filter((connection) => connection.enabled).map((connection) => testMcpConnection(connection));

  if (target === "all") {
    return [await testModel(record), ...(await Promise.all(enabledConnectionTests))];
  }

  const connection = view.dataMcpConnections.find((item) => item.id === target);
  if (!connection) throw new Error("Invalid settings test target");
  return [await testMcpConnection(connection)];
}
