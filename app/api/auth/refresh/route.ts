import { NextResponse } from "next/server";
import { refreshSession } from "@/src/auth/session";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { refreshToken } = (body ?? {}) as Record<string, unknown>;
  if (typeof refreshToken !== "string" || !refreshToken) {
    return NextResponse.json({ error: "refreshToken is required" }, { status: 400 });
  }

  const tokens = await refreshSession(refreshToken);
  if (!tokens) {
    return NextResponse.json({ error: "Invalid or expired refresh token", code: "invalid_refresh" }, { status: 401 });
  }

  return NextResponse.json({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    accessExpiresAt: tokens.accessExpiresAt.toISOString(),
    refreshExpiresAt: tokens.refreshExpiresAt.toISOString()
  });
}
