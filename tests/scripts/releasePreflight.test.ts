import { describe, expect, it } from "vitest";
import { releaseChecks } from "@/scripts/release-preflight-config.mjs";

const validEnvironment = {
  EXPO_PUBLIC_EAS_PROJECT_ID: "d9428888-122b-4c45-9154-36c42d800001",
  EXPO_PUBLIC_API_BASE_URL: "https://api.healthy.example",
  EXPO_IOS_BUNDLE_IDENTIFIER: "com.example.healthybodymanager",
  EXPO_APPLE_TEAM_ID: "ABCDE12345",
  HBM_OPERATOR_NAME: "Healthy Body Manager",
  HBM_PRIVACY_EMAIL: "privacy@healthy.example",
  HBM_POLICY_EFFECTIVE_DATE: "2026-08-01",
  HBM_DEPLOYMENT_REGION: "US-East",
};

describe("release preflight", () => {
  it("passes complete production mobile configuration", () => {
    const checks = releaseChecks(validEnvironment, "运营主体：Healthy Body Manager");
    expect(checks.every((check) => check.ok)).toBe(true);
  });

  it("rejects local URLs, missing signing values, and unset policy metadata", () => {
    const checks = releaseChecks({ EXPO_PUBLIC_API_BASE_URL: "http://localhost:3000" }, "运营主体：待填写");
    expect(checks.filter((check) => !check.ok).map((check) => check.id)).toEqual([
      "eas-project",
      "production-api",
      "ios-identifier",
      "apple-team",
      "privacy-operator",
      "privacy-email",
      "privacy-date",
      "privacy-region",
      "privacy-placeholders",
    ]);
  });

  it("rejects a malformed privacy email and effective date", () => {
    const checks = releaseChecks(
      { ...validEnvironment, HBM_PRIVACY_EMAIL: "not-an-email", HBM_POLICY_EFFECTIVE_DATE: "2026/08/01" },
      "运营主体：Healthy Body Manager"
    );
    const failing = checks.filter((check) => !check.ok).map((check) => check.id);
    expect(failing).toEqual(["privacy-email", "privacy-date"]);
  });
});
