import { NextResponse } from "next/server";
import { destroyBearerSession, destroySession } from "@/src/auth/session";

async function readJson(request: Request) {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const body = await readJson(request);
  const refreshToken = typeof body?.refreshToken === "string" ? body.refreshToken : null;

  if (refreshToken) {
    // Native client logout: invalidate by refresh token.
    await destroyBearerSession(refreshToken);
  } else {
    // Web client logout: invalidate the cookie session.
    await destroySession();
  }

  return NextResponse.json({ ok: true });
}
