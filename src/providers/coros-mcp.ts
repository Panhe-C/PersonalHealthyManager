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
  profile: unknown[];
};

let nextId = 1;

function jsonRpcId(): JsonRpcId {
  return nextId++;
}

/** Latest MCP protocol revision; the server negotiates down if it only supports an older one. */
const MCP_PROTOCOL_VERSION = "2025-06-18";

type McpSession = {
  endpoint: string;
  authHeaders: Record<string, string>;
  /** Session id returned by the server on `initialize` (MCP Streamable HTTP transport). */
  id?: string;
  /**
   * Cookies returned by the server. COROS runs the MCP server behind a load balancer that uses a
   * sticky-session cookie; without echoing it back, follow-up requests can be routed to an instance
   * that does not hold our session and respond with HTTP 404 ("Session not found").
   */
  cookies: Map<string, string>;
};

function createMcpSession(endpoint: string, authHeaders: Record<string, string>): McpSession {
  return { endpoint, authHeaders, cookies: new Map() };
}

/** Record `Set-Cookie` values so subsequent requests stay pinned to the same server instance. */
function captureCookies(session: McpSession, response: Response): void {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const setCookies = typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [];
  const raw = setCookies.length > 0 ? setCookies : (response.headers.get("set-cookie") ? [response.headers.get("set-cookie") as string] : []);

  for (const cookie of raw) {
    const [pair] = cookie.split(";");
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    session.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
}

function cookieHeader(session: McpSession): string | undefined {
  if (session.cookies.size === 0) return undefined;
  return [...session.cookies.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}

/** Errors thrown for HTTP 404 with a session id mean the session was lost; re-initialize and retry. */
function isSessionNotFound(error: unknown): boolean {
  return error instanceof Error && /HTTP 404\b/.test(error.message);
}

/**
 * MCP Streamable HTTP responses may be a single JSON object or an SSE stream of `data:` lines.
 * Extract the JSON-RPC response object that carries the result/error for our request.
 */
function parseMcpResponseText(contentType: string, text: string): JsonRpcResponse | null {
  if (!text) return null;

  if (contentType.includes("text/event-stream")) {
    const messages: JsonRpcResponse[] = [];
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.startsWith("data:") ? line.slice(5).trim() : "";
      if (!trimmed) continue;
      try {
        messages.push(JSON.parse(trimmed) as JsonRpcResponse);
      } catch {
        // Ignore non-JSON SSE comments/keepalives.
      }
    }
    // Prefer a message that actually carries a result/error.
    return messages.find((message) => "result" in message || "error" in message) ?? messages.at(-1) ?? null;
  }

  return JSON.parse(text) as JsonRpcResponse;
}

function buildMcpHeaders(session: McpSession): Record<string, string> {
  const cookie = cookieHeader(session);
  return {
    "Content-Type": "application/json",
    // MCP Streamable HTTP requires the client to accept both JSON and SSE responses.
    Accept: "application/json, text/event-stream",
    ...(session.id ? { "Mcp-Session-Id": session.id } : {}),
    ...(cookie ? { Cookie: cookie } : {}),
    ...session.authHeaders
  };
}

async function jsonRpcCall(session: McpSession, method: string, params?: Record<string, unknown>): Promise<unknown> {
  const request: JsonRpcRequest = {
    jsonrpc: "2.0",
    id: jsonRpcId(),
    method,
    params
  };

  const response = await fetch(session.endpoint, {
    method: "POST",
    headers: buildMcpHeaders(session),
    body: JSON.stringify(request)
  });

  captureCookies(session, response);

  // Servers assign the session id on `initialize`; remember it for subsequent requests.
  const assignedSessionId = response.headers.get("mcp-session-id");
  if (assignedSessionId) session.id = assignedSessionId;

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

  const text = await response.text();
  const json = parseMcpResponseText(response.headers.get("content-type") ?? "", text);

  if (json?.error) {
    throw new Error(`COROS MCP error ${json.error.code}: ${json.error.message}`);
  }

  return json?.result;
}

/** Fire-and-forget JSON-RPC notification (no `id`, no response expected). */
async function jsonRpcNotify(session: McpSession, method: string, params?: Record<string, unknown>): Promise<void> {
  try {
    const response = await fetch(session.endpoint, {
      method: "POST",
      headers: buildMcpHeaders(session),
      body: JSON.stringify({ jsonrpc: "2.0", method, params })
    });
    captureCookies(session, response);
  } catch {
    // Notifications are best-effort; ignore transport errors.
  }
}

/** Open (or re-open) an MCP session: clears any stale id, initializes, and confirms readiness. */
async function initializeSession(session: McpSession): Promise<void> {
  // Per the MCP spec, a fresh session is started by sending `initialize` without a session id.
  // Clear load-balancer cookies too; a stale sticky cookie can pin the new initialize request to
  // the same server instance that already forgot the previous session and returns HTTP 404.
  session.id = undefined;
  session.cookies.clear();
  await jsonRpcCall(session, "initialize", {
    protocolVersion: MCP_PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: {
      name: "healthy-body-manager",
      version: "0.1.0"
    }
  });
  // MCP lifecycle requires the client to confirm initialization before issuing requests.
  await jsonRpcNotify(session, "notifications/initialized");
}

async function initializeSessionWithRetry(session: McpSession, attempts = 3): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await initializeSession(session);
      return;
    } catch (error) {
      lastError = error;
      if (!isSessionNotFound(error) || attempt === attempts - 1) throw error;
    }
  }
  throw lastError;
}

/**
 * Issue a JSON-RPC call, transparently re-initializing the session when the server reports the
 * session as lost (HTTP 404). COROS load-balances MCP requests, so an established session can be
 * unknown to the instance a follow-up request lands on.
 */
async function jsonRpcCallWithRetry(
  session: McpSession,
  method: string,
  params: Record<string, unknown>,
  attempts = 3
): Promise<unknown> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await jsonRpcCall(session, method, params);
    } catch (error) {
      lastError = error;
      if (!isSessionNotFound(error) || attempt === attempts - 1) throw error;
      await initializeSessionWithRetry(session);
    }
  }
  throw lastError;
}

async function callToolWithFreshSession(
  endpoint: string,
  authHeaders: Record<string, string>,
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const session = createMcpSession(endpoint, authHeaders);
  await initializeSessionWithRetry(session);
  return jsonRpcCallWithRetry(session, "tools/call", {
    name,
    arguments: args
  });
}

type McpTool = {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
};

function findMatchingTool(tools: McpTool[], patterns: string[]): McpTool | null {
  for (const pattern of patterns) {
    const match = tools.find((tool) => tool.name.toLowerCase().includes(pattern.toLowerCase()));
    if (match) return match;
  }
  return null;
}

const ACTIVITY_TOOL_PATTERNS = ["sportrecords", "sport_records", "sportrecord", "sport", "activities", "activity", "workout", "exercise"];
const SLEEP_TOOL_PATTERNS = ["sleepdata", "sleep_data", "sleep"];
const RECOVERY_TOOL_PATTERNS = ["recovery", "hrv", "health", "readiness"];
const PROFILE_TOOL_PATTERNS = ["userinfo", "user_info", "profile"];
// Daily vitals live on dedicated tools; the recovery status tool carries only
// the percent, so these are fetched and merged into the same per-day records.
const RESTING_HR_TOOL_PATTERNS = ["restingheartrate", "resting_heart_rate", "resting_hr"];
const STRESS_TOOL_PATTERNS = ["stresslevel", "stress_level"];
const SLEEP_HRV_TOOL_PATTERNS = ["sleephrv", "sleep_hrv"];
const COROS_SYNC_LOOKBACK_DAYS = 14;
const COROS_SYNC_TIMEZONE = "Asia/Shanghai";
const DAY_MS = 24 * 60 * 60 * 1000;

type CorosSyncWindow = {
  days: number;
  startDate: string;
  endDate: string;
};

type CorosSyncKind = "activity" | "sleep" | "recovery" | "vitals";
type CorosTextActivity = {
  labelId: string;
  sportType: number;
  startTime: string;
  endTime: string;
  dateOnly: true;
  averageHeartRateBpm?: number;
  calories?: number;
};
type CorosTextSleep = {
  date: string;
  durationMinutes: number;
  qualityScore?: number;
  deepSleepMinutes?: number;
  lightSleepMinutes?: number;
  remSleepMinutes?: number;
  awakeMinutes?: number;
};
type CorosTextRecovery = {
  date: string;
  recoveryPercent?: number;
};
type CorosTextRestingHeartRate = {
  date: string;
  restingHeartRateBpm: number;
};
type CorosTextStressLevel = {
  date: string;
  stressLevel: number;
};
type CorosTextSleepHrv = {
  date: string;
  hrvMs: number;
};
type CorosTextProfile = {
  heightCm?: number;
  weightKg?: number;
  birthday?: string;
  sex?: string;
};

function compactDateInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) throw new Error("Could not format COROS sync date range.");
  return `${year}${month}${day}`;
}

function recentCorosSyncWindow(now = new Date()): CorosSyncWindow {
  return {
    days: COROS_SYNC_LOOKBACK_DAYS,
    startDate: compactDateInTimeZone(new Date(now.getTime() - (COROS_SYNC_LOOKBACK_DAYS - 1) * DAY_MS), COROS_SYNC_TIMEZONE),
    endDate: compactDateInTimeZone(now, COROS_SYNC_TIMEZONE)
  };
}

function minimalToolArguments(kind: CorosSyncKind, window: CorosSyncWindow): Record<string, unknown> {
  if (kind === "activity") {
    return {
      startDate: window.startDate,
      endDate: window.endDate
    };
  }

  return {
    days: window.days,
    startDate: window.startDate,
    endDate: window.endDate
  };
}

function defaultToolArguments(kind: CorosSyncKind, window: CorosSyncWindow): Record<string, unknown> {
  if (kind === "activity") {
    return {
      startDate: window.startDate,
      endDate: window.endDate,
      limit: 20,
      sportTypeCodes: [65535],
      timezone: COROS_SYNC_TIMEZONE,
      locationKeyword: "",
      minDistanceKm: 0,
      maxDistanceKm: 0,
      minDurationMinutes: 0,
      maxDurationMinutes: 0,
      maxAveragePace: ""
    };
  }

  return {
    days: window.days,
    startDate: window.startDate,
    endDate: window.endDate,
    timezone: COROS_SYNC_TIMEZONE
  };
}

function schemaProperties(inputSchema: Record<string, unknown> | undefined): Record<string, unknown> | null {
  const properties = inputSchema?.properties;
  return properties && typeof properties === "object" && !Array.isArray(properties) ? (properties as Record<string, unknown>) : null;
}

function toolArguments(kind: CorosSyncKind, tool: McpTool, window: CorosSyncWindow): Record<string, unknown> {
  const defaults = defaultToolArguments(kind, window);
  const properties = schemaProperties(tool.inputSchema);
  if (!properties) return minimalToolArguments(kind, window);

  return Object.fromEntries(Object.entries(defaults).filter(([key]) => key in properties));
}

export async function fetchCorosRemoteMcpSnapshot(connection: DataMcpConnection): Promise<CorosRemoteMcpSnapshot> {
  if (!connection.endpoint) throw new Error("COROS MCP endpoint is not configured.");

  const authHeaders = buildDataMcpAuthHeaders(connection);
  if (!authHeaders) throw new Error("COROS MCP authentication is not configured.");

  const endpoint = connection.endpoint.replace(/\/$/, "");
  const session = createMcpSession(endpoint, authHeaders);

  // Step 1: Initialize the MCP session (captures the session id + sticky cookie for later requests)
  await initializeSessionWithRetry(session);

  // Step 2: Discover available tools
  const toolsResult = (await jsonRpcCallWithRetry(session, "tools/list", {})) as { tools?: McpTool[] };
  const tools = toolsResult?.tools ?? [];

  if (tools.length === 0) {
    throw new Error("COROS MCP server did not expose any tools. Check the region and that your COROS account is connected.");
  }

  // Step 3: Find matching tools by name pattern
  const activityTool = findMatchingTool(tools, ACTIVITY_TOOL_PATTERNS);
  const sleepTool = findMatchingTool(tools, SLEEP_TOOL_PATTERNS);
  const recoveryTool = findMatchingTool(tools, RECOVERY_TOOL_PATTERNS);
  const profileTool = findMatchingTool(tools, PROFILE_TOOL_PATTERNS);

  if (!activityTool && !sleepTool && !recoveryTool && !profileTool) {
    throw new Error(
      "COROS MCP server did not expose expected training or health tools. The connection worked but no compatible tools were found."
    );
  }

  const snapshot: CorosRemoteMcpSnapshot = {
    activities: [],
    sleep: [],
    recovery: [],
    profile: []
  };

  const errors: string[] = [];
  const syncWindow = recentCorosSyncWindow();

  if (activityTool) {
    try {
      const result = await callToolWithFreshSession(
        endpoint,
        authHeaders,
        activityTool.name,
        toolArguments("activity", activityTool, syncWindow)
      );
      snapshot.activities = extractPayloadArray(result);
    } catch (error) {
      errors.push(`Activities: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  if (sleepTool) {
    try {
      const result = await callToolWithFreshSession(
        endpoint,
        authHeaders,
        sleepTool.name,
        toolArguments("sleep", sleepTool, syncWindow)
      );
      // A sleep record must carry a duration; this drops anything a
      // mis-matched tool (e.g. a sleep-HRV tool) might return here.
      snapshot.sleep = extractPayloadArray(result).filter(
        (item) => typeof (item as { durationMinutes?: unknown })?.durationMinutes === "number"
      );
    } catch (error) {
      errors.push(`Sleep: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  if (recoveryTool) {
    try {
      const result = await callToolWithFreshSession(
        endpoint,
        authHeaders,
        recoveryTool.name,
        toolArguments("recovery", recoveryTool, syncWindow)
      );
      snapshot.recovery = extractPayloadArray(result);
    } catch (error) {
      errors.push(`Recovery: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  const vitalTools = [
    { tool: findMatchingTool(tools, RESTING_HR_TOOL_PATTERNS), label: "RestingHeartRate" },
    { tool: findMatchingTool(tools, STRESS_TOOL_PATTERNS), label: "StressLevel" },
    { tool: findMatchingTool(tools, SLEEP_HRV_TOOL_PATTERNS), label: "SleepHrv" }
  ];
  for (const { tool, label } of vitalTools) {
    if (!tool) continue;
    try {
      const result = await callToolWithFreshSession(
        endpoint,
        authHeaders,
        tool.name,
        toolArguments("vitals", tool, syncWindow)
      );
      // Keep only records that actually carry one of the vital fields.
      snapshot.recovery.push(
        ...extractPayloadArray(result).filter((item) => {
          const record = item as { restingHeartRateBpm?: unknown; stressLevel?: unknown; hrvMs?: unknown };
          return (
            typeof record?.restingHeartRateBpm === "number" ||
            typeof record?.stressLevel === "number" ||
            typeof record?.hrvMs === "number"
          );
        })
      );
    } catch (error) {
      errors.push(`${label}: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  if (profileTool) {
    try {
      const result = await callToolWithFreshSession(endpoint, authHeaders, profileTool.name, {});
      snapshot.profile = extractPayloadArray(result);
    } catch (error) {
      errors.push(`Profile: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  if (
    errors.length > 0 &&
    snapshot.activities.length === 0 &&
    snapshot.sleep.length === 0 &&
    snapshot.recovery.length === 0 &&
    snapshot.profile.length === 0
  ) {
    throw new Error(`COROS MCP data fetch failed: ${errors.join("; ")}`);
  }

  if (errors.length > 0) {
    const imported = [];
    if (snapshot.activities.length > 0) imported.push(`${snapshot.activities.length} activities`);
    if (snapshot.sleep.length > 0) imported.push(`${snapshot.sleep.length} sleep records`);
    if (snapshot.recovery.length > 0) imported.push(`${snapshot.recovery.length} recovery records`);
    if (snapshot.profile.length > 0) imported.push(`${snapshot.profile.length} profile records`);
    console.warn(`COROS MCP partial sync: imported ${imported.join(", ")}. Errors: ${errors.join("; ")}`);
  }

  return snapshot;
}

export type CorosMcpOAuthEndpoints = {
  authorizeUrl: string;
  tokenUrl: string;
  /** RFC 7591 dynamic client registration (COROS exposes this on official MCP hosts) */
  registrationEndpoint?: string;
};

/**
 * COROS advertises `scopes_supported: ["openid", "mcp.tools", "offline_access"]`.
 * The hosted authorize flow re-issues the post-login request with all three scopes, so the
 * client must request the full set up front (matching official MCP clients) or the
 * `login_ticket` leg fails with a 400 Bad Request.
 */
export const COROS_OAUTH_DEFAULT_SCOPES = "openid mcp.tools offline_access";

/** Bump when COROS dynamic registration metadata must change (forces client re-registration). */
export const COROS_OAUTH_REGISTRATION_VERSION = 3;

function parseOAuthAuthorizationServerMetadata(metadata: Record<string, unknown>): CorosMcpOAuthEndpoints | null {
  const authorizeUrl = (metadata.authorization_endpoint || metadata.authorizeUrl) as string | undefined;
  const tokenUrl = (metadata.token_endpoint || metadata.tokenUrl) as string | undefined;
  const registrationEndpoint = (metadata.registration_endpoint || metadata.registrationEndpoint) as string | undefined;

  if (!authorizeUrl || !tokenUrl) return null;
  return {
    authorizeUrl,
    tokenUrl,
    ...(typeof registrationEndpoint === "string" && registrationEndpoint ? { registrationEndpoint } : {})
  };
}

async function fetchCorosOAuthAuthorizationServerMetadata(origin: string): Promise<CorosMcpOAuthEndpoints | null> {
  const wellKnownUrl = `${origin.replace(/\/$/, "")}/.well-known/oauth-authorization-server`;
  const response = await fetch(wellKnownUrl);
  if (!response.ok) return null;
  const metadata = (await response.json()) as Record<string, unknown>;
  return parseOAuthAuthorizationServerMetadata(metadata);
}

export async function registerCorosOAuthClient(registrationEndpoint: string, redirectUri: string): Promise<{ clientId: string }> {
  const response = await fetch(registrationEndpoint.replace(/\/$/, ""), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: "Healthy Body Manager",
      redirect_uris: [redirectUri],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      application_type: "web",
      scope: COROS_OAUTH_DEFAULT_SCOPES
    })
  });

  if (!response.ok) {
    let detail = "";
    try {
      detail = await response.text();
    } catch {
      detail = "";
    }
    throw new Error(
      `COROS OAuth client registration failed with HTTP ${response.status}${detail ? `: ${detail.slice(0, 240)}` : ""}`
    );
  }

  const body = (await response.json()) as { client_id?: string };
  if (!body.client_id) {
    throw new Error("COROS OAuth client registration response did not include client_id.");
  }

  return { clientId: body.client_id };
}

export async function discoverCorosMcpOAuthEndpoints(connection: DataMcpConnection): Promise<CorosMcpOAuthEndpoints | null> {
  if (!connection.endpoint) return null;

  const endpoint = connection.endpoint.replace(/\/$/, "");
  const mcpOrigin = new URL(endpoint).origin;

  let fromInitialize: Pick<CorosMcpOAuthEndpoints, "authorizeUrl" | "tokenUrl"> | null = null;

  // Try MCP initialize to discover OAuth metadata
  try {
    const result = await jsonRpcCall(createMcpSession(endpoint, {}), "initialize", {
      protocolVersion: MCP_PROTOCOL_VERSION,
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
        fromInitialize = { authorizeUrl, tokenUrl };
      }
    }
  } catch {
    // MCP initialize failed, try well-known discovery
  }

  let fromWellKnown: CorosMcpOAuthEndpoints | null = null;
  try {
    fromWellKnown = await fetchCorosOAuthAuthorizationServerMetadata(mcpOrigin);
  } catch {
    // Well-known discovery failed
  }

  if (fromInitialize) {
    return {
      authorizeUrl: fromInitialize.authorizeUrl,
      tokenUrl: fromInitialize.tokenUrl,
      registrationEndpoint: fromWellKnown?.registrationEndpoint
    };
  }

  return fromWellKnown;
}

function parseDurationMinutes(value: string): number | null {
  const hourMinute = value.match(/(\d+)\s*h(?:ours?)?\s*(?:(\d+)\s*m(?:in)?)?/i);
  if (hourMinute) {
    return Number(hourMinute[1]) * 60 + (hourMinute[2] ? Number(hourMinute[2]) : 0);
  }

  const parts = value.split(":").map((part) => Number(part));
  if (parts.some((part) => !Number.isFinite(part))) return null;
  if (parts.length === 3) return Math.round(parts[0] * 60 + parts[1] + parts[2] / 60);
  if (parts.length === 2) return Math.round(parts[0] + parts[1] / 60);
  return null;
}

function dateTimeInCorosTimeZone(date: string, minutesFromMidnight: number): string {
  const hours = Math.floor(minutesFromMidnight / 60);
  const minutes = minutesFromMidnight % 60;
  return `${date}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00+08:00`;
}

function parseSportRecordsText(text: string): CorosTextActivity[] {
  if (!text.includes("Sport Records")) return [];

  const entries = text.split(/\n(?=\d+\.\s)/);
  return entries.flatMap((entry) => {
    const heading = entry.match(/^\d+\.\s+(.+?)\s+[—-]\s+(\d{4}-\d{2}-\d{2})/m);
    const label = entry.match(/LabelId:\s*([^\s|]+)/);
    const sportType = entry.match(/SportType:\s*(\d+)/);
    const duration = entry.match(/Duration:\s*([0-9:]+)/);
    if (!heading || !label || !sportType || !duration) return [];

    const durationMinutes = parseDurationMinutes(duration[1]);
    if (durationMinutes == null) return [];

    const startTime = dateTimeInCorosTimeZone(heading[2], 6 * 60);
    const endTime = dateTimeInCorosTimeZone(heading[2], 6 * 60 + durationMinutes);
    const heartRate = entry.match(/Avg HR:\s*(\d+)\s*bpm/);
    const calories = entry.match(/Calories:\s*(\d+)\s*kcal/);

    return [
      {
        labelId: label[1],
        sportType: Number(sportType[1]),
        startTime,
        endTime,
        dateOnly: true,
        ...(heartRate ? { averageHeartRateBpm: Number(heartRate[1]) } : {}),
        ...(calories ? { calories: Number(calories[1]) } : {})
      }
    ];
  });
}

function parseSleepDataText(text: string): CorosTextSleep[] {
  if (!text.includes("Sleep Data")) return [];

  const blocks = text.split(/\n(?=\d{4}-\d{2}-\d{2}\n)/);
  return blocks.flatMap((block) => {
    const date = block.match(/^(\d{4}-\d{2}-\d{2})$/m);
    const mainSleep = block.match(/Main Sleep:\s*([^\n]+)/);
    if (!date || !mainSleep) return [];

    const durationMinutes = parseDurationMinutes(mainSleep[1]);
    if (durationMinutes == null) return [];

    const score = block.match(/Sleep Score:\s*(\d+)/);
    const stageMinutes = (label: string) => {
      const direct = block.match(new RegExp(`${label}(?: Sleep)?(?: Duration)?:\\s*([^\\n]+)`, "i"));
      if (direct) {
        const parsed = parseDurationMinutes(direct[1]);
        if (parsed != null) return parsed;
      }
      const ratio = block.match(new RegExp(`${label}(?: Sleep)? Ratio:\\s*(\\d+(?:\\.\\d+)?)%`, "i"));
      return ratio ? Math.round(durationMinutes * Number(ratio[1]) / 100) : undefined;
    };
    const deepSleepMinutes = stageMinutes("Deep");
    const lightSleepMinutes = stageMinutes("Light");
    const remSleepMinutes = stageMinutes("REM");
    const awakeMinutes = stageMinutes("Awake");
    return [
      {
        date: date[1],
        durationMinutes,
        ...(score ? { qualityScore: Number(score[1]) } : {}),
        ...(deepSleepMinutes != null ? { deepSleepMinutes } : {}),
        ...(lightSleepMinutes != null ? { lightSleepMinutes } : {}),
        ...(remSleepMinutes != null ? { remSleepMinutes } : {}),
        ...(awakeMinutes != null ? { awakeMinutes } : {})
      }
    ];
  });
}

function parseRecoveryStatusText(text: string): CorosTextRecovery[] {
  if (!text.includes("Recovery Status")) return [];

  const recovery = text.match(/Recovery:\s*(\d+)%/);
  if (!recovery) return [];

  return [
    {
      date: compactDateInTimeZone(new Date(), COROS_SYNC_TIMEZONE),
      recoveryPercent: Number(recovery[1])
    }
  ];
}

function parseRestingHeartRateText(text: string): CorosTextRestingHeartRate[] {
  if (!text.includes("Resting Heart Rate")) return [];

  const rows: CorosTextRestingHeartRate[] = [];
  for (const match of text.matchAll(/^(\d{4}-\d{2}-\d{2}):\s*(\d+)\s*bpm\s*$/gm)) {
    rows.push({ date: match[1], restingHeartRateBpm: Number(match[2]) });
  }
  return rows;
}

function parseStressLevelText(text: string): CorosTextStressLevel[] {
  if (!text.includes("Stress Level")) return [];

  const rows: CorosTextStressLevel[] = [];
  for (const match of text.matchAll(/^(\d{4}-\d{2}-\d{2}):\s*\r?\n\s*Average Stress:\s*(\d+)/gm)) {
    rows.push({ date: match[1], stressLevel: Number(match[2]) });
  }
  return rows;
}

/** Reads only the official assessment section ("HRV Avg: N ms"), never the raw time series. */
function parseSleepHrvText(text: string): CorosTextSleepHrv[] {
  if (!text.includes("HRV Assessment")) return [];

  const rows: CorosTextSleepHrv[] = [];
  for (const match of text.matchAll(/^(\d{4}-\d{2}-\d{2}):\s*\r?\n\s*HRV Avg:\s*(\d+)\s*ms/gm)) {
    rows.push({ date: match[1], hrvMs: Number(match[2]) });
  }
  return rows;
}

function parseUserProfileText(text: string): CorosTextProfile[] {
  if (!text.includes("User Profile Information")) return [];

  const height = text.match(/Height:\s*([\d.]+)\s*cm/i);
  const weight = text.match(/Weight:\s*([\d.]+)\s*kg/i);
  const birthday = text.match(/Birthday:\s*(\d{4}-\d{2}-\d{2})/i);
  const gender = text.match(/Gender:\s*([^\n]+)/i);
  const sex = gender?.[1]?.trim().toLowerCase();

  return [
    {
      ...(height ? { heightCm: Number(height[1]) } : {}),
      ...(weight ? { weightKg: Number(weight[1]) } : {}),
      ...(birthday ? { birthday: birthday[1] } : {}),
      ...(sex === "male" || sex === "female" ? { sex } : {})
    }
  ];
}

function parseCorosTextPayload(text: string): unknown[] {
  return [
    ...parseSportRecordsText(text),
    ...parseSleepDataText(text),
    ...parseRecoveryStatusText(text),
    ...parseRestingHeartRateText(text),
    ...parseStressLevelText(text),
    ...parseSleepHrvText(text),
    ...parseUserProfileText(text)
  ];
}

function extractPayloadArray(result: unknown): unknown[] {
  if (typeof result === "string") {
    try {
      const parsed = JSON.parse(result);
      if (parsed !== result) return extractPayloadArray(parsed);
    } catch {
      // Not JSON; parse supported COROS text formats below.
    }
    return parseCorosTextPayload(result);
  }

  if (Array.isArray(result)) return result;

  if (result && typeof result === "object") {
    const obj = result as Record<string, unknown>;

    for (const key of ["data", "result", "items", "records"]) {
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
              return parseCorosTextPayload(contentItem.text);
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
