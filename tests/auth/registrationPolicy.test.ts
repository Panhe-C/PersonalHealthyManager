import { afterEach, describe, expect, it, vi } from "vitest";
import { isRegistrationEnabled } from "@/src/auth/registrationPolicy";

describe("registration policy", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("keeps self-service registration enabled by default in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("HBM_REGISTRATION_ENABLED", "");
    expect(isRegistrationEnabled()).toBe(true);
  });

  it("keeps self-service registration closed by default in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("HBM_REGISTRATION_ENABLED", "");
    expect(isRegistrationEnabled()).toBe(false);
  });

  it("honors an explicit true or false value", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("HBM_REGISTRATION_ENABLED", "true");
    expect(isRegistrationEnabled()).toBe(true);
    vi.stubEnv("HBM_REGISTRATION_ENABLED", "false");
    expect(isRegistrationEnabled()).toBe(false);
  });
});
