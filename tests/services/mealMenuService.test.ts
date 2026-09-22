/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadMealMenusForDate } from "@/src/services/mealMenuService";
import { prisma } from "@/src/db/client";
import { fetchMealMenusFromStdioMcp } from "@/src/providers/meal-menu-mcp";
import { loadDataMcpConnection } from "@/src/settings/service";
import { defaultDataMcpConnections } from "@/src/settings/defaults";

vi.mock("@/src/db/client", () => ({
  prisma: {
    mealMenu: { findMany: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() }
  }
}));

vi.mock("@/src/providers/meal-menu-mcp", () => ({
  fetchMealMenusFromStdioMcp: vi.fn()
}));

vi.mock("@/src/settings/service", () => ({
  loadDataMcpConnection: vi.fn()
}));

const date = new Date("2026-06-26T00:00:00+08:00");

function configuredConnection() {
  return {
    ...defaultDataMcpConnections[2],
    transport: "stdio" as const,
    larkSession: "session-cookie",
    canteenName: "北京融中心"
  } as never;
}

describe("meal menu service cache", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns cached menus without spawning the MCP process", async () => {
    vi.mocked(prisma.mealMenu.findMany).mockResolvedValue([
      {
        source: "bytecanteen",
        date,
        meal: "lunch",
        itemsJson: JSON.stringify([{ name: "香煎鸡胸", calories: 520, proteinGrams: 42, carbohydrateGrams: 35, fatGrams: 16, tags: ["high-protein"] }])
      }
    ] as never);

    const result = await loadMealMenusForDate("user-1", date);

    expect(fetchMealMenusFromStdioMcp).not.toHaveBeenCalled();
    expect(prisma.mealMenu.createMany).not.toHaveBeenCalled();
    expect(result.status).toBe("ok");
    expect(result.menus[0]).toMatchObject({ source: "bytecanteen", meal: "lunch" });
    expect(result.menus[0].items[0].name).toBe("香煎鸡胸");
  });

  it("fetches from MCP and upserts when the cache is empty", async () => {
    vi.mocked(prisma.mealMenu.findMany).mockResolvedValue([] as never);
    vi.mocked(loadDataMcpConnection).mockResolvedValue(configuredConnection());
    vi.mocked(fetchMealMenusFromStdioMcp).mockResolvedValue([
      { source: "bytecanteen", date, meal: "lunch", items: [{ name: "番茄牛腩", calories: 600, proteinGrams: 38, carbohydrateGrams: 50, fatGrams: 18, tags: [] }] }
    ]);

    const result = await loadMealMenusForDate("user-1", date);

    expect(fetchMealMenusFromStdioMcp).toHaveBeenCalled();
    expect(prisma.mealMenu.createMany).toHaveBeenCalled();
    expect(result.status).toBe("ok");
    expect(result.menus[0].items[0].name).toBe("番茄牛腩");
  });

  it("reports no menus and never calls MCP when no connection is configured", async () => {
    vi.mocked(prisma.mealMenu.findMany).mockResolvedValue([] as never);
    vi.mocked(loadDataMcpConnection).mockResolvedValue(null);

    const result = await loadMealMenusForDate("user-1", date);

    expect(fetchMealMenusFromStdioMcp).not.toHaveBeenCalled();
    expect(result).toEqual({ status: "not_configured", menus: [] });
  });

  it("reports a configured connection that fails as failed rather than empty", async () => {
    vi.mocked(prisma.mealMenu.findMany).mockResolvedValue([] as never);
    vi.mocked(loadDataMcpConnection).mockResolvedValue(configuredConnection());
    vi.mocked(fetchMealMenusFromStdioMcp).mockRejectedValue(new Error("MCP down"));

    const result = await loadMealMenusForDate("user-1", date);

    expect(result).toEqual({ status: "failed", menus: [], error: "MCP down" });
  });
});
