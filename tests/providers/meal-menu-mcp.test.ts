/** @vitest-environment node */
import { PassThrough } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import type { DataMcpConnection } from "@/src/settings/defaults";
import { buildChildEnv, fetchMealMenusFromStdioMcp } from "@/src/providers/meal-menu-mcp";

const spawnMock = vi.hoisted(() => vi.fn());

vi.mock("node:child_process", () => ({
  spawn: spawnMock
}));

function frame(message: unknown) {
  const body = JSON.stringify(message);
  return `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`;
}

function createMcpProcess() {
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const writes: string[] = [];
  const child = {
    stdout,
    stderr,
    stdin: {
      write: vi.fn((chunk: string | Buffer) => {
        writes.push(String(chunk));
        const parsed = JSON.parse(String(chunk).split("\r\n\r\n")[1]);
        if (parsed.method === "initialize") {
          stdout.write(frame({ jsonrpc: "2.0", id: parsed.id, result: { protocolVersion: "2025-06-18" } }));
        }
        if (parsed.method === "tools/list") {
          stdout.write(
            frame({
              jsonrpc: "2.0",
              id: parsed.id,
              result: {
                tools: [
                  {
                    name: "get_today_menu",
                    description: "Get canteen menu",
                    inputSchema: { properties: { canteenName: {}, date: {} } }
                  }
                ]
              }
            })
          );
        }
        if (parsed.method === "tools/call") {
          stdout.write(
            frame({
              jsonrpc: "2.0",
              id: parsed.id,
              result: {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify({
                      menus: [
                        {
                          meal: "lunch",
                          items: [
                            {
                              name: "香煎鸡胸",
                              calories: 520,
                              proteinGrams: 42,
                              carbohydrateGrams: 35,
                              fatGrams: 16,
                              tags: ["high-protein", "light"]
                            }
                          ]
                        }
                      ]
                    })
                  }
                ]
              }
            })
          );
        }
        return true;
      }),
      end: vi.fn()
    },
    kill: vi.fn(),
    on: vi.fn()
  };
  return { child, writes };
}

describe("meal menu MCP provider", () => {
  it("calls a local bytecanteen MCP server and normalizes returned menus", async () => {
    const { child, writes } = createMcpProcess();
    spawnMock.mockReturnValueOnce(child);
    const connection: DataMcpConnection = {
      id: "meal_menu",
      label: "Meal Menu",
      enabled: true,
      serverName: "bytecanteen",
      capabilityName: "today-menu",
      transport: "stdio",
      endpoint: "",
      command: "npx",
      args: "-y @byted/mcp-bytecanteen@latest",
      canteenName: "北京融中心",
      larkSession: "session-cookie-123456",
      auth: { type: "none" },
      notes: ""
    };

    const menus = await fetchMealMenusFromStdioMcp(connection, new Date("2026-06-02T00:00:00+08:00"));

    expect(spawnMock).toHaveBeenCalledWith(
      "npx",
      ["-y", "@byted/mcp-bytecanteen@latest"],
      expect.objectContaining({
        env: expect.objectContaining({ LARK_SESSION: "session-cookie-123456" })
      })
    );
    const toolCall = writes.map((write) => JSON.parse(write.split("\r\n\r\n")[1])).find((message) => message.method === "tools/call");
    expect(toolCall.params).toEqual({
      name: "get_today_menu",
      arguments: {
        canteenName: "北京融中心",
        date: "2026-06-01"
      }
    });
    expect(menus).toEqual([
      {
        source: "bytecanteen",
        date: new Date("2026-06-01T16:00:00.000Z"),
        meal: "lunch",
        items: [
          {
            name: "香煎鸡胸",
            calories: 520,
            proteinGrams: 42,
            carbohydrateGrams: 35,
            fatGrams: 16,
            tags: ["high-protein", "light"]
          }
        ]
      }
    ]);
    expect(child.kill).toHaveBeenCalled();
  });

  it("keeps server secrets out of the child process environment", () => {
    process.env.SESSION_SECRET = "session-secret-value";
    process.env.SETTINGS_ENCRYPTION_KEY = "settings-encryption-key-value";
    process.env.DATABASE_URL = "file:./should-not-leak.db";

    const env = buildChildEnv({ LARK_SESSION: "session-cookie-123456" });

    expect(env.LARK_SESSION).toBe("session-cookie-123456");
    expect(env.SESSION_SECRET).toBeUndefined();
    expect(env.SETTINGS_ENCRYPTION_KEY).toBeUndefined();
    expect(env.DATABASE_URL).toBeUndefined();
    expect(env.PATH).toBe(process.env.PATH);
  });
});
