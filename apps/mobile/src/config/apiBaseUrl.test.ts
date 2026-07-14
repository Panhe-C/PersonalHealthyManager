import { describe, expect, it } from "vitest";
import { resolveApiBaseUrl } from "./apiBaseUrl";

describe("resolveApiBaseUrl", () => {
  it("prefers the Expo public runtime URL and removes trailing slashes", () => {
    expect(resolveApiBaseUrl(" http://192.168.1.20:3000/ ", "http://localhost:3000"))
      .toBe("http://192.168.1.20:3000");
  });

  it("falls back to the Expo config URL for simulator development", () => {
    expect(resolveApiBaseUrl(undefined, "http://localhost:3000"))
      .toBe("http://localhost:3000");
  });

  it.each(["", "localhost:3000", "ftp://192.168.1.20"])(
    "rejects an unusable API origin: %s",
    (value) => {
      expect(() => resolveApiBaseUrl(value, undefined)).toThrow("Mobile API base URL");
    }
  );
});
