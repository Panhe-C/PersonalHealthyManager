import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type EncryptedSecret = {
  encryptedApiKey: string;
  apiKeyIv: string;
  apiKeyTag: string;
  apiKeyHint: string;
};

export type EncryptedApiKey = EncryptedSecret;

function parseEncryptionKey() {
  const configured = process.env.SETTINGS_ENCRYPTION_KEY;
  if (configured) {
    const base64 = Buffer.from(configured, "base64");
    if (base64.length === 32) return base64;

    const raw = Buffer.from(configured);
    if (raw.length === 32) return raw;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("SETTINGS_ENCRYPTION_KEY must be configured in production");
  }

  return Buffer.from("dev-settings-key-32-bytes-local!");
}

export function maskApiKey(apiKey: string) {
  const trimmed = apiKey.trim();
  const suffix = trimmed.slice(-4);
  if (trimmed.startsWith("sk-")) return `sk-...${suffix}`;
  return `...${suffix}`;
}

export function encryptSecret(secret: string): EncryptedSecret {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", parseEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    encryptedApiKey: encrypted.toString("base64"),
    apiKeyIv: iv.toString("base64"),
    apiKeyTag: tag.toString("base64"),
    apiKeyHint: maskApiKey(secret)
  };
}

export function encryptApiKey(apiKey: string): EncryptedApiKey {
  return encryptSecret(apiKey);
}

export function decryptSecret(input: { encryptedApiKey: string; apiKeyIv: string; apiKeyTag: string }) {
  const decipher = createDecipheriv("aes-256-gcm", parseEncryptionKey(), Buffer.from(input.apiKeyIv, "base64"));
  decipher.setAuthTag(Buffer.from(input.apiKeyTag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(input.encryptedApiKey, "base64")), decipher.final()]).toString("utf8");
}

export function decryptApiKey(input: { encryptedApiKey: string; apiKeyIv: string; apiKeyTag: string }) {
  return decryptSecret(input);
}
