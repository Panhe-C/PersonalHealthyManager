import type { MealMenu, MealMenuItem } from "@/src/domain/models";
import { prisma } from "@/src/db/client";
import { getMockMealMenu } from "@/src/providers/meal-menu";
import { fetchMealMenusFromStdioMcp } from "@/src/providers/meal-menu-mcp";
import { loadDataMcpConnection } from "@/src/settings/service";

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

export async function getMealMenusForDate(userId: string, date: Date): Promise<MealMenu[]> {
  const dayStart = startOfDay(date);
  const cached = await prisma.mealMenu.findMany({
    where: { userId, date: dayStart }
  });

  if (cached.length > 0) return deserializeMenus(cached);

  const connection = await loadDataMcpConnection(userId, "meal_menu");
  if (connection?.enabled && connection.transport === "stdio") {
    try {
      const menus = await fetchMealMenusFromStdioMcp(connection, dayStart);
      if (menus.length > 0) {
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
        return menus;
      }
    } catch {
      return getMockMealMenu(dayStart);
    }
  }

  return getMockMealMenu(dayStart);
}
