import type { DataMcpConnection } from "@/src/settings/defaults";
import { buildDataMcpAuthHeaders } from "@/src/settings/service";

type JsonRpcId = string | number;

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  method: string;
  params?: Record<string, unknown>;
};

type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

export type CorosRemoteMcpSnapshot = {
  activities: unknown[];
  sleep: unknown[];
  recovery: unknown[];
};

let nextId = 1;

function jsonRpcId(): JsonRpcId {
  return nextId++;
}

async function jsonRpcCall(endpoint: string, headers: Record<string, string>, method: string, params?: Record<string, unknown>): Promise<unknown> {
  const request: JsonRpcRequest = {
    jsonrpc: "2.0",
    id: jsonRpcId(),
    method,
    params
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    let body = "";
    try {
      body = await response.text();
    } catch {
      body = "";
    }
    const suffix = body ? `: ${body.slice(0, 200)}` : "";
    throw new Error(`COROS MCP returned HTTP ${response.status}${suffix}`);
  }

  const json = (await response.json()) as JsonRpcResponse;

  if (json.error) {
    throw new Error(`COROS MCP error ${json.error.code}: ${json.error.message}`);
  }

  return json.result;
}

type McpTool = {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
};

function findMatchingTool(tools: McpTool[], patterns: string[]): string | null {
  for (const pattern of patterns) {
    const match = tools.find((tool) => tool.name.toLowerCase().includes(pattern.toLowerCase()));
    if (match) return match.name;
  }
  return null;
}

const ACTIVITY_TOOL_PATTERNS = ["activities", "activity", "workout", "training", "exercise"];
const SLEEP_TOOL_PATTERNS = ["sleep"];
const RECOVERY_TOOL_PATTERNS = ["recovery", "hrv", "health", "readiness"];

export async function fetchCorosRemoteMcpSnapshot(connection: DataMcpConnection): Promise<CorosRemoteMcpSnapshot> {
  if (!connection.endpoint) throw new Error("COROS MCP endpoint is not configured.");

  const authHeaders = buildDataMcpAuthHeaders(connection);
  if (!authHeaders) throw new Error("COROS MCP authentication is not configured.");

  const endpoint = connection.endpoint.replace(/\/$/, "");

  // Step 1: Initialize MCP session
  await jsonRpcCall(endpoint, authHeaders, "initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: {
      name: "healthy-body-manager",
      version: "0.1.0"
    }
  });

  // Step 2: Discover available tools
  const toolsResult = (await jsonRpcCall(endpoint, authHeaders, "tools/list", {})) as { tools?: McpTool[] };
  const tools = toolsResult?.tools ?? [];

  if (tools.length === 0) {
    throw new Error("COROS MCP server did not expose any tools. Check the region and that your COROS account is connected.");
  }

  // Step 3: Find matching tools by name pattern
  const activityTool = findMatchingTool(tools, ACTIVITY_TOOL_PATTERNS);
  const sleepTool = findMatchingTool(tools, SLEEP_TOOL_PATTERNS);
  const recoveryTool = findMatchingTool(tools, RECOVERY_TOOL_PATTERNS);



  if (!activityTool && !sleepTool && !recoveryTool) {
    throw new Error(
      "COROS MCP server did not expose expected training or health tools. The connection worked but no compatible tools were found."
    );
  }

  const snapshot: CorosRemoteMcpSnapshot = {
    activities: [],
    sleep: [],
    recovery: []
  };

  const errors: string[] = [];

  if (activityTool) {
    try {
      const result = await jsonRpcCall(endpoint, authHeaders, "tools/call", {
        name: activityTool,
        arguments: {}
      });
      snapshot.activities = extractPayloadArray(result);
    } catch (error) {
      errors.push(`Activities: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  if (sleepTool) {
    try {
      const result = await jsonRpcCall(endpoint, authHeaders, "tools/call", {
        name: sleepTool,
        arguments: {}
      });
      snapshot.sleep = extractPayloadArray(result);
    } catch (error) {
      errors.push(`Sleep: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  if (recoveryTool) {
    try {
      const result = await jsonRpcCall(endpoint, authHeaders, "tools/call", {
        name: recoveryTool,
        arguments: {}
      });
      snapshot.recovery = extractPayloadArray(result);
    } catch (error) {
      errors.push(`Recovery: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  if (errors.length > 0 && snapshot.activities.length === 0 && snapshot.sleep.length === 0 && snapshot.recovery.length === 0) {
    throw new Error(`COROS MCP data fetch failed: ${errors.join("; ")}`);
  }

  if (errors.length > 0) {
    const imported = [];
    if (snapshot.activities.length > 0) imported.push(`${snapshot.activities.length} activities`);
    if (snapshot.sleep.length > 0) imported.push(`${snapshot.sleep.length} sleep records`);
    if (snapshot.recovery.length > 0) imported.push(`${snapshot.recovery.length} recovery records`);
    console.warn(`COROS MCP partial sync: imported ${imported.join(", ")}. Errors: ${errors.join("; ")}`);
  }

  return snapshot;
}

export type CorosMcpOAuthEndpoints = {
  authorizeUrl: string;
  tokenUrl: string;
};

export async function discoverCorosMcpOAuthEndpoints(connection: DataMcpConnection): Promise<CorosMcpOAuthEndpoints | null> {
  if (!connection.endpoint) return null;

  const endpoint = connection.endpoint.replace(/\/$/, "");

  // Try MCP initialize to discover OAuth metadata
  try {
    const result = await jsonRpcCall(endpoint, {}, "initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: {
        name: "healthy-body-manager",
        version: "0.1.0"
      }
    });

    if (result && typeof result === "object") {
      const meta = result as Record<string, unknown>;

      // Look for OAuth metadata in various possible locations
      const oauth = (meta._meta as Record<string, unknown>)?.oauth as Record<string, string> | undefined;
      const serverOAuth = (meta.serverInfo as Record<string, unknown>)?.oauth as Record<string, string> | undefined;

      const authorizeUrl = oauth?.authorizationUrl || oauth?.authorizeUrl || serverOAuth?.authorizationUrl || serverOAuth?.authorizeUrl;
      const tokenUrl = oauth?.tokenUrl || serverOAuth?.tokenUrl;

      if (authorizeUrl && tokenUrl) {
        return { authorizeUrl, tokenUrl };
      }
    }
  } catch {
    // MCP initialize failed, try well-known discovery
  }

  // Fallback: try OAuth well-known discovery
  try {
    const baseUrl = new URL(endpoint);
    const wellKnownUrl = `${baseUrl.origin}/.well-known/oauth-authorization-server`;
    const response = await fetch(wellKnownUrl);

    if (response.ok) {
      const metadata = (await response.json()) as Record<string, unknown>;
      const authorizeUrl = (metadata.authorization_endpoint || metadata.authorizeUrl) as string | undefined;
      const tokenUrl = (metadata.token_endpoint || metadata.tokenUrl) as string | undefined;

      if (authorizeUrl && tokenUrl) {
        return { authorizeUrl, tokenUrl };
      }
    }
  } catch {
    // Well-known discovery also failed
  }

  return null;
}

function extractPayloadArray(result: unknown): unknown[] {
  if (Array.isArray(result)) return result;

  if (result && typeof result === "object") {
    const obj = result as Record<string, unknown>;

    for (const key of ["data", "result", "items", "records", "content"]) {
      if (Array.isArray(obj[key])) return obj[key] as unknown[];
    }

    // MCP tool result may wrap content in a content array of {type: "text", text: "..."} items
    if (Array.isArray(obj.content)) {
      for (const item of obj.content as unknown[]) {
        if (item && typeof item === "object") {
          const contentItem = item as Record<string, unknown>;
          if (contentItem.type === "text" && typeof contentItem.text === "string") {
            try {
              const parsed = JSON.parse(contentItem.text);
              return extractPayloadArray(parsed);
            } catch {
              // Not JSON, continue
            }
          }
          if (contentItem.type === "resource" && typeof contentItem.resource === "object") {
            const resource = contentItem.resource as Record<string, unknown>;
            if (typeof resource.text === "string") {
              try {
                return extractPayloadArray(JSON.parse(resource.text));
              } catch {
                // Not JSON, continue
              }
            }
          }
        }
      }
    }
  }

  return [];
}
