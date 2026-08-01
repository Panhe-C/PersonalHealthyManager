import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import type { MealMenu, MealMenuItem } from "@/src/domain/models";
import { buildDataMcpStdioEnv } from "@/src/settings/service";
import type { DataMcpConnection } from "@/src/settings/defaults";

type JsonRpcResponse = {
  id?: number;
  result?: unknown;
  error?: { message?: string };
};

type McpTool = {
  name: string;
  description?: string;
  inputSchema?: {
    properties?: Record<string, unknown>;
  };
};

function splitArgs(value: string | undefined): string[] {
  const input = String(value ?? "").trim();
  if (!input) return [];

  const matches = input.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? [];
  return matches.map((item) => item.replace(/^["']|["']$/g, ""));
}

function mcpFrame(message: unknown) {
  const body = JSON.stringify(message);
  return `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`;
}

type McpBuffer = Buffer<ArrayBufferLike>;

function parseMcpFrames(buffer: McpBuffer): { messages: JsonRpcResponse[]; rest: McpBuffer } {
  const messages: JsonRpcResponse[] = [];
  let rest = buffer;

  while (true) {
    const headerEnd = rest.indexOf("\r\n\r\n");
    if (headerEnd === -1) break;

    const header = rest.slice(0, headerEnd).toString("utf8");
    const lengthMatch = /Content-Length:\s*(\d+)/i.exec(header);
    if (!lengthMatch) {
      rest = rest.slice(headerEnd + 4);
      continue;
    }

    const length = Number(lengthMatch[1]);
    const bodyStart = headerEnd + 4;
    const bodyEnd = bodyStart + length;
    if (rest.length < bodyEnd) break;

    const body = rest.slice(bodyStart, bodyEnd);
    messages.push(JSON.parse(body.toString("utf8")) as JsonRpcResponse);
    rest = rest.slice(bodyEnd);
  }

  return { messages, rest };
}

class StdioMcpClient {
  private nextId = 1;
  private buffer: McpBuffer = Buffer.alloc(0);
  private pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();

  constructor(private readonly child: ChildProcessWithoutNullStreams) {
    child.stdout.on("data", (chunk) => this.handleData(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))));
    child.stderr.on("data", () => {});
  }

  async request(method: string, params?: unknown): Promise<unknown> {
    const id = this.nextId++;
    const payload = {
      jsonrpc: "2.0",
      id,
      method,
      ...(params === undefined ? {} : { params })
    };

    const response = new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`MCP request timed out: ${method}`));
      }, 15000);
      this.pending.set(id, { resolve, reject, timer });
    });

    this.child.stdin.write(mcpFrame(payload));
    return response;
  }

  notify(method: string, params?: unknown) {
    this.child.stdin.write(
      mcpFrame({
        jsonrpc: "2.0",
        method,
        ...(params === undefined ? {} : { params })
      })
    );
  }

  close() {
    this.child.stdin.end();
    this.child.kill();
  }

  private handleData(chunk: McpBuffer) {
    const parsed = parseMcpFrames(Buffer.concat([this.buffer, chunk]));
    this.buffer = parsed.rest;

    for (const message of parsed.messages) {
      if (typeof message.id !== "number") continue;
      const pending = this.pending.get(message.id);
      if (!pending) continue;

      clearTimeout(pending.timer);
      this.pending.delete(message.id);
      if (message.error) {
        pending.reject(new Error(message.error.message || "MCP request failed"));
      } else {
        pending.resolve(message.result);
      }
    }
  }
}

/**
 * The only variables the MCP child process inherits. An explicit allowlist
 * rather than `process.env` keeps `SESSION_SECRET`, `SETTINGS_ENCRYPTION_KEY`,
 * and `DATABASE_URL` out of a process whose package is resolved at run time:
 * leaking the first two is enough to forge any session and decrypt every stored
 * provider key. The entries kept here are what `npx` needs to resolve and fetch
 * the package on a corporate network.
 */
const inheritedEnvKeys = [
  "PATH",
  "HOME",
  "TMPDIR",
  "LANG",
  "LC_ALL",
  "NODE_EXTRA_CA_CERTS",
  "NPM_CONFIG_REGISTRY",
  "npm_config_registry",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "NO_PROXY",
  "http_proxy",
  "https_proxy",
  "no_proxy"
] as const;

export function buildChildEnv(secrets: Record<string, string>): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { NODE_ENV: process.env.NODE_ENV };

  for (const key of inheritedEnvKeys) {
    const value = process.env[key];
    if (typeof value === "string") env[key] = value;
  }

  return { ...env, ...secrets };
}

function dateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function chooseMenuTool(tools: McpTool[]) {
  return (
    tools.find((tool) => /menu|canteen|食堂|菜单|菜谱/i.test(`${tool.name} ${tool.description ?? ""}`)) ??
    tools[0]
  );
}

function buildToolArguments(tool: McpTool, canteenName: string, date: Date): Record<string, string> {
  const properties = Object.keys(tool.inputSchema?.properties ?? {});
  const args: Record<string, string> = {};

  for (const property of properties) {
    if (/canteen|cafeteria|location|region|campus|office|食堂|工区/i.test(property)) {
      args[property] = canteenName;
    }
    if (/date|day|日期/i.test(property)) {
      args[property] = dateInput(date);
    }
  }

  if (canteenName && !Object.keys(args).some((key) => /canteen|cafeteria|location|region|campus|office|食堂|工区/i.test(key))) {
    args.canteenName = canteenName;
  }
  if (!Object.keys(args).some((key) => /date|day|日期/i.test(key))) {
    args.date = dateInput(date);
  }

  return args;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function tagsValue(value: unknown) {
  return Array.isArray(value) ? value.map(String) : [];
}

function mealValue(value: unknown): MealMenu["meal"] {
  const text = String(value ?? "").toLowerCase();
  if (text.includes("breakfast") || text.includes("早餐")) return "breakfast";
  if (text.includes("dinner") || text.includes("晚餐")) return "dinner";
  return "lunch";
}

function normalizeItem(input: Record<string, unknown>): MealMenuItem {
  return {
    name: String(input.name ?? input.title ?? input.dishName ?? input.dish ?? "Menu item"),
    calories: numberValue(input.calories ?? input.kcal),
    proteinGrams: numberValue(input.proteinGrams ?? input.protein),
    carbohydrateGrams: numberValue(input.carbohydrateGrams ?? input.carbs ?? input.carbohydrate),
    fatGrams: numberValue(input.fatGrams ?? input.fat),
    tags: tagsValue(input.tags)
  };
}

function extractPayload(result: unknown): unknown {
  const maybeResult = result as { content?: Array<{ text?: string }>; structuredContent?: unknown };
  if (maybeResult.structuredContent) return maybeResult.structuredContent;

  const text = maybeResult.content?.find((item) => typeof item.text === "string")?.text;
  if (!text) return result;

  try {
    return JSON.parse(text);
  } catch {
    return { menus: [{ meal: "lunch", items: [{ name: text, tags: ["from-mcp"] }] }] };
  }
}

function normalizeMenus(payload: unknown, date: Date): MealMenu[] {
  const value = payload as { menus?: unknown; menu?: unknown; items?: unknown; dishes?: unknown; data?: unknown; result?: unknown };
  if (value.data) return normalizeMenus(value.data, date);
  if (value.result) return normalizeMenus(value.result, date);

  const menusInput = Array.isArray(value.menus)
    ? value.menus
    : Array.isArray(value.menu)
      ? value.menu
      : [{ meal: "lunch", items: value.items ?? value.dishes ?? [] }];

  return menusInput
    .map((menu) => {
      const item = menu as { meal?: unknown; items?: unknown; dishes?: unknown };
      const rawItems = Array.isArray(item.items) ? item.items : Array.isArray(item.dishes) ? item.dishes : [];
      return {
        source: "bytecanteen" as const,
        date,
        meal: mealValue(item.meal),
        items: rawItems.map((rawItem) => normalizeItem(rawItem as Record<string, unknown>))
      };
    })
    .filter((menu) => menu.items.length > 0);
}

export async function fetchMealMenusFromStdioMcp(connection: DataMcpConnection, date: Date): Promise<MealMenu[]> {
  const env = buildDataMcpStdioEnv(connection);
  if (!env) throw new Error("Meal Menu LARK_SESSION is required.");

  const command = connection.command || "npx";
  const child = spawn(command, splitArgs(connection.args), {
    env: buildChildEnv(env),
    stdio: "pipe"
  });
  const client = new StdioMcpClient(child);

  try {
    await client.request("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "healthy-body-manager", version: "0.1.0" }
    });
    client.notify("notifications/initialized");

    const listed = (await client.request("tools/list")) as { tools?: McpTool[] };
    const tool = chooseMenuTool(listed.tools ?? []);
    if (!tool) throw new Error("Meal Menu MCP server did not expose any tools.");

    const result = await client.request("tools/call", {
      name: tool.name,
      arguments: buildToolArguments(tool, connection.canteenName ?? "", date)
    });

    return normalizeMenus(extractPayload(result), date);
  } finally {
    client.close();
  }
}
