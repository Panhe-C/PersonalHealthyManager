import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SALT_BYTES = 16;
const KEY_BYTES = 64;
const HEX_PATTERN = /^[a-f0-9]+$/i;

export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_BYTES);
  const hash = scryptSync(password, salt, KEY_BYTES);

  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (typeof storedHash !== "string") {
    return false;
  }

  const parts = storedHash.split(":");
  if (parts.length !== 2) {
    return false;
  }

  const [saltHex, hashHex] = parts;
  if (
    saltHex.length !== SALT_BYTES * 2 ||
    hashHex.length !== KEY_BYTES * 2 ||
    !HEX_PATTERN.test(saltHex) ||
    !HEX_PATTERN.test(hashHex)
  ) {
    return false;
  }

  try {
    const salt = Buffer.from(saltHex, "hex");
    const expectedHash = Buffer.from(hashHex, "hex");
    const actualHash = scryptSync(password, salt, KEY_BYTES);

    if (expectedHash.length !== actualHash.length) {
      return false;
    }

    return timingSafeEqual(expectedHash, actualHash);
  } catch {
    return false;
  }
}
