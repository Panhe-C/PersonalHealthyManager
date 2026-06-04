import type { MealMenu, MealMenuItem, TrainingIntensity } from "@/src/domain/models";

export type NutritionRecommendation = {
  calorieTarget: string;
  proteinTargetGrams: number;
  carbohydrateGuidance: string;
  recommended: MealMenuItem[];
  caution: MealMenuItem[];
};

export function recommendMenuChoices(input: {
  menus: MealMenu[];
  trainingIntensity: TrainingIntensity;
  primaryGoal: string;
}): NutritionRecommendation {
  const items = input.menus.flatMap((menu) => menu.items);
  const recommended = items
    .filter((item) => item.proteinGrams >= 35 || item.tags.includes("light"))
    .sort((left, right) => right.proteinGrams - left.proteinGrams);
  const caution = items.filter((item) => item.tags.includes("fried") || item.fatGrams >= 30);

  return {
    calorieTarget: input.primaryGoal.toLowerCase().includes("loss") ? "moderate deficit" : "maintenance",
    proteinTargetGrams: 120,
    carbohydrateGuidance:
      input.trainingIntensity === "hard"
        ? "prioritize carbohydrates before and after training"
        : "keep carbohydrates moderate and pair them with protein",
    recommended,
    caution
  };
}
