import { describe, expect, it } from "vitest";
import { getMockMealMenu } from "@/src/providers/meal-menu";

describe("mock meal menu provider", () => {
  it("returns breakfast, lunch, and dinner menu items with nutrition and tags", () => {
    const menus = getMockMealMenu(new Date("2026-06-02T00:00:00+08:00"));

    expect(menus.map((menu) => menu.meal).sort()).toEqual(["breakfast", "dinner", "lunch"]);
    expect(menus).toHaveLength(3);

    for (const menu of menus) {
      expect(menu.source).toBe("mock");
      expect(menu.date.toISOString()).toBe("2026-06-01T16:00:00.000Z");
      expect(menu.items.length).toBeGreaterThan(0);

      for (const item of menu.items) {
        expect(item).toEqual({
          name: expect.any(String),
          calories: expect.any(Number),
          proteinGrams: expect.any(Number),
          carbohydrateGrams: expect.any(Number),
          fatGrams: expect.any(Number),
          tags: expect.any(Array)
        });
        expect(item.tags.length).toBeGreaterThan(0);
      }
    }
  });
});
