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

  it("still produces targets and guidance without any menus", () => {
    const result = recommendMenuChoices({
      menus: [],
      trainingIntensity: "hard",
      primaryGoal: "Fat loss"
    });

    expect(result.calorieTarget).toBe("moderate deficit");
    expect(result.proteinTargetGrams).toBe(120);
    expect(result.carbohydrateGuidance).toBe("prioritize carbohydrates before and after training");
    expect(result.recommended).toEqual([]);
    expect(result.caution).toEqual([]);
  });
});
