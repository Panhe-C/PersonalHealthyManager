import * as SecureStore from "expo-secure-store";
import { z } from "zod";

const ACCESS_TOKEN_KEY = "hbm.access_token";
const REFRESH_TOKEN_KEY = "hbm.refresh_token";
const ACCESS_EXPIRES_KEY = "hbm.access_expires_at";

export interface TokenBundle {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: string;
  refreshExpiresAt?: string;
}

export async function loadTokens(): Promise<TokenBundle | null> {
  const [accessToken, refreshToken, accessExpiresAt] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
    SecureStore.getItemAsync(ACCESS_EXPIRES_KEY)
  ]);
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken, accessExpiresAt: accessExpiresAt ?? "", refreshExpiresAt: undefined };
}

export async function saveTokens(tokens: TokenBundle): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken),
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken),
    SecureStore.setItemAsync(ACCESS_EXPIRES_KEY, tokens.accessExpiresAt)
  ]);
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    SecureStore.deleteItemAsync(ACCESS_EXPIRES_KEY)
  ]);
}

// In-memory mirror so we don't await SecureStore on every request.
let cached: TokenBundle | null = null;

export async function getAccessToken(): Promise<string | null> {
  if (cached?.accessToken) return cached.accessToken;
  cached = await loadTokens();
  return cached?.accessToken ?? null;
}

export async function setTokens(tokens: TokenBundle): Promise<void> {
  cached = tokens;
  await saveTokens(tokens);
}

export async function resetTokens(): Promise<void> {
  cached = null;
  await clearTokens();
}

export function getRefreshToken(): string | null {
  return cached?.refreshToken ?? null;
}
