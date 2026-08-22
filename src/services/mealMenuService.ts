import type { MealMenu, MealMenuItem } from "@/src/domain/models";
import { prisma } from "@/src/db/client";
import { captureError } from "@/src/observability/logger";
import { fetchMealMenusFromStdioMcp } from "@/src/providers/meal-menu-mcp";
import { loadDataMcpConnection } from "@/src/settings/service";

/**
 * Why this is a result rather than a bare array: an empty menu list has two
 * very different causes, and collapsing them is what let a placeholder menu
 * reach real users. `not_configured` is the normal state for an account with no
 * meal menu connection, and every surface hides the menu entirely. `failed`
 * means the user did configure one and it is broken, which has to be visible
 * somewhere or they will never find out.
 */
export type MealMenuResult =
  | { status: "ok"; menus: MealMenu[] }
  | { status: "not_configured"; menus: [] }
  | { status: "failed"; menus: []; error: string };

function startOfDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function deserializeMenus(
  rows: Array<{ source: string; date: Date; meal: string; itemsJson: string }>
): MealMenu[] {
  return rows.map((row) => ({
    source: row.source as MealMenu["source"],
    date: row.date,
    meal: row.meal as MealMenu["meal"],
    items: JSON.parse(row.itemsJson) as MealMenuItem[]
  }));
}

export async function loadMealMenusForDate(userId: string, date: Date): Promise<MealMenuResult> {
  const dayStart = startOfDay(date);
  const cached = await prisma.mealMenu.findMany({
    where: { userId, date: dayStart }
  });

  if (cached.length > 0) return { status: "ok", menus: deserializeMenus(cached) };

  const connection = await loadDataMcpConnection(userId, "meal_menu");
  if (!connection?.enabled || connection.transport !== "stdio") {
    return { status: "not_configured", menus: [] };
  }

  try {
    const menus = await fetchMealMenusFromStdioMcp(connection, dayStart);
    if (menus.length === 0) return { status: "ok", menus: [] };

    await prisma.mealMenu.deleteMany({ where: { userId, date: dayStart } });
    await prisma.mealMenu.createMany({
      data: menus.map((menu) => ({
        userId,
        source: menu.source,
        date: dayStart,
        meal: menu.meal,
        itemsJson: JSON.stringify(menu.items)
      }))
    });
    return { status: "ok", menus };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Meal menu request failed";
    captureError("meal_menu_fetch_failed", error, { date: dayStart.toISOString() });
    return { status: "failed", menus: [], error: message };
  }
}
