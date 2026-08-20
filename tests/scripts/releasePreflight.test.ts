import { describe, expect, it } from "vitest";
import { mobileReleaseChecks } from "@/scripts/release-mobile-config.mjs";
import { webReleaseChecks } from "@/scripts/release-web-config.mjs";

const validMobileEnvironment = {
  EXPO_PUBLIC_EAS_PROJECT_ID: "d9428888-122b-4c45-9154-36c42d800001",
  EXPO_PUBLIC_API_BASE_URL: "https://www.cbhdev.xyz",
  EXPO_IOS_BUNDLE_IDENTIFIER: "com.example.healthybodymanager",
  EXPO_APPLE_TEAM_ID: "ABCDE12345",
  EXPO_PUBLIC_REGISTRATION_ENABLED: "false",
};

const validWebEnvironment = {
  HBM_APP_BASE_URL: "https://www.cbhdev.xyz",
  HBM_PUBLIC_BASE_URL: "https://www.cbhdev.xyz",
  HBM_OPERATOR_NAME: "Configured by the deployer",
  HBM_PRIVACY_EMAIL: "privacy@cbhdev.xyz",
  HBM_POLICY_EFFECTIVE_DATE: "2026-08-01",
  HBM_DEPLOYMENT_REGION: "中国大陆",
  HBM_REGISTRATION_ENABLED: "false",
  HBM_EMAIL_TRANSPORT: "console",
};

describe("web release preflight", () => {
  it("passes the canonical origin and a closed-registration production policy", () => {
    const checks = webReleaseChecks(validWebEnvironment, "运营主体由环境变量提供");
    expect(checks.every((check) => check.ok)).toBe(true);
  });

  it("rejects non-canonical or mismatched origins and missing policy metadata", () => {
    const checks = webReleaseChecks(
      {
        HBM_APP_BASE_URL: "https://cbhdev.xyz",
        HBM_PUBLIC_BASE_URL: "https://other.example",
        HBM_REGISTRATION_ENABLED: "false",
        HBM_EMAIL_TRANSPORT: "console",
      },
      "运营主体：待填写（运营主体）",
    );
    expect(checks.filter((check) => !check.ok).map((check) => check.id)).toEqual(expect.arrayContaining([
      "canonical-app-origin",
      "canonical-public-origin",
      "origin-match",
      "privacy-operator",
      "privacy-email",
      "privacy-date",
      "privacy-region",
      "privacy-placeholders",
    ]));
  });

  it("allows direct registration without SMTP email delivery", () => {
    const checks = webReleaseChecks(
      { ...validWebEnvironment, HBM_REGISTRATION_ENABLED: "true", HBM_EMAIL_TRANSPORT: "console" },
      "运营主体由环境变量提供",
    );
    expect(checks.every((check) => check.ok)).toBe(true);
  });

  it("passes enabled registration only with a complete SMTP policy", () => {
    const checks = webReleaseChecks(
      {
        ...validWebEnvironment,
        HBM_REGISTRATION_ENABLED: "true",
        HBM_EMAIL_TRANSPORT: "smtp",
        HBM_EMAIL_FROM: "Healthy Body Manager <no-reply@cbhdev.xyz>",
        HBM_SMTP_HOST: "smtp.example.com",
        HBM_SMTP_PORT: "587",
        HBM_SMTP_SECURE: "false",
        HBM_SMTP_USER: "mailer",
        HBM_SMTP_PASSWORD: "injected-secret",
      },
      "运营主体由环境变量提供",
    );
    expect(checks.every((check) => check.ok)).toBe(true);
  });
});

describe("mobile release preflight", () => {
  it("passes complete production iOS configuration", () => {
    const checks = mobileReleaseChecks(validMobileEnvironment);
    expect(checks.every((check) => check.ok)).toBe(true);
  });

  it("rejects a non-canonical API, missing signing values, and malformed identifiers", () => {
    const checks = mobileReleaseChecks({ EXPO_PUBLIC_API_BASE_URL: "https://api.cbhdev.xyz" });
    expect(checks.filter((check) => !check.ok).map((check) => check.id)).toEqual([
      "eas-project",
      "production-api",
      "ios-identifier",
      "apple-team",
      "registration-setting",
    ]);
  });
});
