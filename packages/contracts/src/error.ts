import { NextResponse } from "next/server";

export interface ApiError {
  error: string;
  code?: string;
}

/**
 * Unified error response shape: `{ error, code? }`. Native clients intercept 401
 * to trigger refresh/re-login; other codes map to UI messaging.
 */
export function jsonError(error: string, status: number, code?: string): NextResponse<ApiError> {
  return NextResponse.json<ApiError>({ error, code }, { status });
}
