import { describe, expect, it } from "vitest";
import { resolveRegistrationEnabled } from "./registrationPolicy";

describe("mobile registration configuration", () => {
  it("uses the explicit app config value", () => {
    expect(resolveRegistrationEnabled(true)).toBe(true);
    expect(resolveRegistrationEnabled(false)).toBe(false);
  });

  it("fails closed when a release config omits the value", () => {
    expect(resolveRegistrationEnabled(undefined)).toBe(false);
  });
});
