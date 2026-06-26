/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultDataMcpConnections } from "@/src/settings/defaults";
import { fetchMealMenusFromStdioMcp } from "@/src/providers/meal-menu-mcp";
import { loadDataMcpConnection } from "@/src/settings/service";
import { resolveMealMenusForPlan } from "@/src/services/planService";

vi.mock("@/src/db/client", () => ({
  prisma: {}
}));

vi.mock("@/src/settings/service", () => ({
  loadDataMcpConnection: vi.fn()
}));

vi.mock("@/src/providers/meal-menu-mcp", () => ({
  fetchMealMenusFromStdioMcp: vi.fn()
}));

describe("plan service meal menu source", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the configured local Meal Menu MCP connection", async () => {
    const connection = {
      ...defaultDataMcpConnections[2],
      transport: "stdio" as const,
      command: "npx",
      args: "-y @byted/mcp-bytecanteen@latest",
      larkSession: "session-cookie-123456",
      canteenName: "北京融中心"
    };
    const mcpMenus = [
      {
        source: "bytecanteen" as const,
        date: new Date("2026-06-01T16:00:00.000Z"),
        meal: "lunch" as const,
        items: [
          {
            name: "香煎鸡胸",
            calories: 520,
            proteinGrams: 42,
            carbohydrateGrams: 35,
            fatGrams: 16,
            tags: ["high-protein"]
          }
        ]
      }
    ];
    vi.mocked(loadDataMcpConnection).mockResolvedValue(connection);
    vi.mocked(fetchMealMenusFromStdioMcp).mockResolvedValue(mcpMenus);

    const menus = await resolveMealMenusForPlan("user-1", new Date("2026-06-02T00:00:00+08:00"));

    expect(fetchMealMenusFromStdioMcp).toHaveBeenCalledWith(connection, new Date("2026-06-02T00:00:00+08:00"));
    expect(menus).toBe(mcpMenus);
  });

  it("falls back to mock menus when Meal Menu MCP is not configured", async () => {
    vi.mocked(loadDataMcpConnection).mockResolvedValue({
      ...defaultDataMcpConnections[2],
      transport: "http"
    });

    const menus = await resolveMealMenusForPlan("user-1", new Date("2026-06-02T00:00:00+08:00"));

    expect(fetchMealMenusFromStdioMcp).not.toHaveBeenCalled();
    expect(menus[0].source).toBe("mock");
  });
});
