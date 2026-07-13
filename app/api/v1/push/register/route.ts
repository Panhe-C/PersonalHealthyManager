import { NextResponse } from "next/server";
import { withUser } from "@/src/auth/api";
import { registerPushToken } from "@/src/services/pushService";

export const POST = withUser(async (user, request: Request) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body", code: "invalid_body" }, { status: 400 });
  }

  const { token, platform } = (body ?? {}) as Record<string, unknown>;
  if (typeof token !== "string" || !token) {
    return NextResponse.json({ error: "token is required", code: "token_required" }, { status: 400 });
  }

  const saved = await registerPushToken(
    user.id,
    token,
    typeof platform === "string" ? platform : "ios"
  );
  return NextResponse.json({ ok: true, id: saved.id });
});
