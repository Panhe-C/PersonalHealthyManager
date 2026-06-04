import { describe, expect, it } from "vitest";
import { parseBodyProfileInput } from "@/src/services/profileService";

describe("profile service validation", () => {
  it("accepts a complete profile input", () => {
    const profile = parseBodyProfileInput({
      heightCm: 178,
      weightKg: 72,
      sex: "male",
      trainingExperience: "intermediate",
      injuries: ["left knee sensitivity"],
      dietaryPreferences: ["high protein"],
      trainingPreferences: ["morning runs"]
    });

    expect(profile.heightCm).toBe(178);
    expect(profile.injuries).toEqual(["left knee sensitivity"]);
  });
});
