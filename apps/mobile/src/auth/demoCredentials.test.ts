import { describe, expect, it } from "vitest";
import { demoCredentials } from "./demoCredentials";

describe("mobile demo credentials", () => {
  it("matches the local demo account used by the web login", () => {
    expect(demoCredentials).toEqual({
      email: "demo@example.com",
      password: "healthy-body-demo"
    });
  });
});
