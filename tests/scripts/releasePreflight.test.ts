import { describe, expect, it } from "vitest";
import { releaseChecks } from "@/scripts/release-preflight-config.mjs";

const validEnvironment = {
  EXPO_PUBLIC_EAS_PROJECT_ID: "d9428888-122b-4c45-9154-36c42d800001",
  EXPO_PUBLIC_API_BASE_URL: "https://api.healthy.example",
  EXPO_IOS_BUNDLE_IDENTIFIER: "com.example.healthybodymanager",
  EXPO_APPLE_TEAM_ID: "ABCDE12345",
};

describe("release preflight", () => {
  it("passes complete production mobile configuration", () => {
    const checks = releaseChecks(validEnvironment, "运营主体：Healthy Body Manager");
    expect(checks.every((check) => check.ok)).toBe(true);
  });

  it("rejects local URLs, missing signing values, and privacy placeholders", () => {
    const checks = releaseChecks({ EXPO_PUBLIC_API_BASE_URL: "http://localhost:3000" }, "运营主体：待填写");
    expect(checks.filter((check) => !check.ok).map((check) => check.id)).toEqual([
      "eas-project",
      "production-api",
      "ios-identifier",
      "apple-team",
      "privacy-metadata",
    ]);
  });
});
