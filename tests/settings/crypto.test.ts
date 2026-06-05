import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decryptApiKey, encryptApiKey, maskApiKey } from "@/src/settings/crypto";

const previousKey = process.env.SETTINGS_ENCRYPTION_KEY;

describe("settings crypto", () => {
  beforeEach(() => {
    process.env.SETTINGS_ENCRYPTION_KEY = "12345678901234567890123456789012";
  });

  afterEach(() => {
    if (previousKey === undefined) {
      delete process.env.SETTINGS_ENCRYPTION_KEY;
    } else {
      process.env.SETTINGS_ENCRYPTION_KEY = previousKey;
    }
  });

  it("encrypts and decrypts an API key without exposing plaintext in storage", () => {
    const encrypted = encryptApiKey("sk-test-123456");

    expect(encrypted.encryptedApiKey).not.toContain("sk-test");
    expect(decryptApiKey(encrypted)).toBe("sk-test-123456");
  });

  it("returns a short non-sensitive key hint", () => {
    expect(maskApiKey("sk-test-123456")).toBe("sk-...3456");
    expect(maskApiKey("plain-secret")).toBe("...cret");
  });
});
