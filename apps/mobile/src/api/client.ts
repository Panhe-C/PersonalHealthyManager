import Constants from "expo-constants";
import { z } from "zod";
import { getAccessToken, getRefreshToken, setTokens, resetTokens } from "../auth/tokenStore";

const API_BASE_URL = (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ?? "http://localhost:3000";
const V1 = `${API_BASE_URL}/api/v1`;

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
  }
}

type Json = Record<string, unknown> | unknown[];

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

// Single-flight refresh: while a refresh is in flight, concurrent 401s queue
// and replay against the result of the single refresh.
let refreshInFlight: Promise<string | null> | null = null;

async function doRefresh(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken })
  });
  if (!response.ok) return null;

  const body = (await response.json()) as {
    accessToken: string;
    refreshToken: string;
    accessExpiresAt: string;
    refreshExpiresAt?: string;
  };
  await setTokens({
    accessToken: body.accessToken,
    refreshToken: body.refreshToken,
    accessExpiresAt: body.accessExpiresAt,
    refreshExpiresAt: body.refreshExpiresAt
  });
  return body.accessToken;
}

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = doRefresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  // zod schema to validate the response body. Throws ApiError on mismatch.
  schema?: z.ZodTypeAny;
  headers?: Record<string, string>;
  skipAuthRefresh?: boolean;
  // Internal: avoid infinite refresh loop.
  _retried?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = path.startsWith("http") ? path : `${V1}${path}`;
  const accessToken = await getAccessToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers ?? {})
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined
  });

  if (response.status === 401 && !options.skipAuthRefresh && !options._retried) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return request<T>(path, { ...options, _retried: true });
    }
    await resetTokens();
    onUnauthorized?.();
    throw new ApiError("Unauthorized", 401, "unauthorized");
  }

  if (!response.ok) {
    let body: { error?: string; code?: string } = {};
    try {
      body = await response.json();
    } catch {
      // ignore
    }
    if (response.status === 401 && !options.skipAuthRefresh) {
      await resetTokens();
      onUnauthorized?.();
    }
    throw new ApiError(body.error ?? `Request failed with ${response.status}`, response.status, body.code);
  }

  const text = await response.text();
  const json = text ? JSON.parse(text) : null;
  if (options.schema) {
    const parsed = options.schema.safeParse(json);
    if (!parsed.success) {
      throw new ApiError(`Response did not match expected schema: ${parsed.error.message}`, response.status, "schema_mismatch");
    }
    return parsed.data as T;
  }
  return json as T;
}

export const api = {
  get: <T>(path: string, schema?: z.ZodTypeAny) => request<T>(path, { method: "GET", schema }),
  post: <T>(path: string, body?: unknown, schema?: z.ZodTypeAny) => request<T>(path, { method: "POST", body, schema }),
  patch: <T>(path: string, body?: unknown, schema?: z.ZodTypeAny) => request<T>(path, { method: "PATCH", body, schema }),
  delete: <T>(path: string, schema?: z.ZodTypeAny) => request<T>(path, { method: "DELETE", schema }),
  // Auth calls hit /api/auth (not /api/v1/auth) — same handlers, but the login
  // flow needs to be reachable before a token exists.
  auth: {
    login: (email: string, password: string) =>
      request<{ ok: true; accessToken: string; refreshToken: string; accessExpiresAt: string; refreshExpiresAt: string }>(
        `${API_BASE_URL}/api/auth/login`,
        { method: "POST", body: { email, password }, skipAuthRefresh: true }
      ),
    logout: (refreshToken?: string) =>
      request<{ ok: true }>(`${API_BASE_URL}/api/auth/logout`, { method: "POST", body: refreshToken ? { refreshToken } : {} })
  }
};
