import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/src/auth/password";

describe("password hashing", () => {
  it("stores a random 16-byte salt and 64-byte scrypt hash", () => {
    const first = hashPassword("healthy-body-demo");
    const second = hashPassword("healthy-body-demo");

    const [firstSalt, firstHash] = first.split(":");
    const [secondSalt, secondHash] = second.split(":");

    expect(firstSalt).toMatch(/^[a-f0-9]{32}$/);
    expect(firstHash).toMatch(/^[a-f0-9]{128}$/);
    expect(secondSalt).toMatch(/^[a-f0-9]{32}$/);
    expect(secondHash).toMatch(/^[a-f0-9]{128}$/);
    expect(second).not.toBe(first);
  });

  it("verifies the matching password and rejects a different password", () => {
    const storedHash = hashPassword("healthy-body-demo");

    expect(verifyPassword("healthy-body-demo", storedHash)).toBe(true);
    expect(verifyPassword("wrong-password", storedHash)).toBe(false);
  });

  it.each([
    "",
    "missing-separator",
    ":",
    "salt:",
    ":hash",
    "too:many:parts",
    "zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz:" + "00".repeat(64),
    "00".repeat(16) + ":not-hex",
    "00".repeat(16) + ":" + "00".repeat(63)
  ])("safely rejects malformed stored hash %j", (storedHash) => {
    expect(verifyPassword("healthy-body-demo", storedHash)).toBe(false);
  });
});
