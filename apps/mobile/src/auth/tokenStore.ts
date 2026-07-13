import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const ACCESS_TOKEN_KEY = "hbm.access_token";
const REFRESH_TOKEN_KEY = "hbm.refresh_token";
const ACCESS_EXPIRES_KEY = "hbm.access_expires_at";

// expo-secure-store is native-only; on web (and any non-native target) we fall
// back to AsyncStorage, which is backed by localStorage. Tokens are not as
// hardened on web, but it keeps the same async API and unblocks web previews.
const storage =
  Platform.OS === "web"
    ? {
        getItem: (key: string) => AsyncStorage.getItem(key),
        setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
        deleteItem: (key: string) => AsyncStorage.removeItem(key)
      }
    : {
        getItem: (key: string) => SecureStore.getItemAsync(key),
        setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
        deleteItem: (key: string) => SecureStore.deleteItemAsync(key)
      };

export interface TokenBundle {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: string;
  refreshExpiresAt?: string;
}

export async function loadTokens(): Promise<TokenBundle | null> {
  const [accessToken, refreshToken, accessExpiresAt] = await Promise.all([
    storage.getItem(ACCESS_TOKEN_KEY),
    storage.getItem(REFRESH_TOKEN_KEY),
    storage.getItem(ACCESS_EXPIRES_KEY)
  ]);
  if (!accessToken || !refreshToken) return null;
  cached = { accessToken, refreshToken, accessExpiresAt: accessExpiresAt ?? "", refreshExpiresAt: undefined };
  return cached;
}

export async function saveTokens(tokens: TokenBundle): Promise<void> {
  cached = tokens;
  await Promise.all([
    storage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken),
    storage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken),
    storage.setItem(ACCESS_EXPIRES_KEY, tokens.accessExpiresAt)
  ]);
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    storage.deleteItem(ACCESS_TOKEN_KEY),
    storage.deleteItem(REFRESH_TOKEN_KEY),
    storage.deleteItem(ACCESS_EXPIRES_KEY)
  ]);
}

// In-memory mirror so we don't await storage on every request.
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
