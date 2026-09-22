import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NutritionPanel } from "@/components/NutritionPanel";

const guidance = {
  calorieTarget: "moderate deficit",
  proteinTargetGrams: 120,
  carbohydrateGuidance: "keep carbohydrates moderate and pair them with protein"
};

describe("NutritionPanel", () => {
  it("shows the dietary targets without any menu-derived lists", () => {
    render(<NutritionPanel nutrition={{ ...guidance, recommended: [], caution: [] }} />);

    expect(screen.getByText("moderate deficit")).toBeInTheDocument();
    expect(screen.getByText("120g per day")).toBeInTheDocument();
    expect(screen.getByText(guidance.carbohydrateGuidance)).toBeInTheDocument();
    expect(screen.queryByText("Recommended menu choices")).not.toBeInTheDocument();
    expect(screen.queryByText("Use caution")).not.toBeInTheDocument();
  });

  it("adds the menu choices once an imported menu is available", () => {
    render(
      <NutritionPanel
        nutrition={{
          ...guidance,
          recommended: [{ name: "香煎鸡胸", calories: 520, proteinGrams: 42 }],
          caution: [{ name: "炸鸡", calories: 830, fatGrams: 34 }]
        }}
      />
    );

    expect(screen.getByText("Recommended menu choices")).toBeInTheDocument();
    expect(screen.getByText("香煎鸡胸")).toBeInTheDocument();
    expect(screen.getByText("Use caution")).toBeInTheDocument();
    expect(screen.getByText("炸鸡")).toBeInTheDocument();
  });
});
