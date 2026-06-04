import type { MealMenu } from "@/src/domain/models";

export function getMockMealMenu(date: Date): MealMenu[] {
  return [
    {
      source: "mock",
      date,
      meal: "breakfast",
      items: [
        {
          name: "Oatmeal with eggs",
          calories: 430,
          proteinGrams: 24,
          carbohydrateGrams: 52,
          fatGrams: 12,
          tags: ["high-protein", "moderate-carb"]
        },
        {
          name: "Soy milk and steamed bun",
          calories: 520,
          proteinGrams: 18,
          carbohydrateGrams: 78,
          fatGrams: 14,
          tags: ["high-carb"]
        }
      ]
    },
    {
      source: "mock",
      date,
      meal: "lunch",
      items: [
        {
          name: "Chicken rice bowl",
          calories: 680,
          proteinGrams: 42,
          carbohydrateGrams: 72,
          fatGrams: 20,
          tags: ["high-protein"]
        },
        {
          name: "Fried noodles",
          calories: 830,
          proteinGrams: 25,
          carbohydrateGrams: 96,
          fatGrams: 34,
          tags: ["fried", "high-carb"]
        }
      ]
    },
    {
      source: "mock",
      date,
      meal: "dinner",
      items: [
        {
          name: "Fish, vegetables, and rice",
          calories: 610,
          proteinGrams: 40,
          carbohydrateGrams: 58,
          fatGrams: 18,
          tags: ["high-protein", "light"]
        },
        {
          name: "Beef noodle soup",
          calories: 760,
          proteinGrams: 36,
          carbohydrateGrams: 88,
          fatGrams: 24,
          tags: ["high-carb"]
        }
      ]
    }
  ];
}
