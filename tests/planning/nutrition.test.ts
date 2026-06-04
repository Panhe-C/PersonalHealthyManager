import { describe, expect, it } from "vitest";
import { recommendMenuChoices } from "@/src/planning/nutrition";
import { mealMenus } from "@/src/test/factories";

describe("nutrition planning", () => {
  it("prefers high-protein menu items and cautions fried items", () => {
    const result = recommendMenuChoices({
      menus: mealMenus(),
      trainingIntensity: "moderate",
      primaryGoal: "Fat loss"
    });

    expect(result.recommended[0].name).toBe("Chicken rice bowl");
    expect(result.caution[0].name).toBe("Fried noodles");
  });
});
