import { NextResponse } from "next/server";
import { withUser } from "@/src/auth/api";
import { handleMcpOAuthCallback } from "@/src/settings/service";

export const GET = withUser(async (user, request: Request) => {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    const failed = new URL("/settings", url.origin);
    failed.searchParams.set("auth", "failed");
    failed.searchParams.set("error", "Missing OAuth code or state");
    return NextResponse.redirect(failed);
  }

  try {
    const connection = await handleMcpOAuthCallback(user.id, { code, state, origin: url.origin });
    const settings = new URL("/settings", url.origin);
    settings.searchParams.set("mcp", connection);
    settings.searchParams.set("auth", "connected");
    return NextResponse.redirect(settings);
  } catch (error) {
    const failed = new URL("/settings", url.origin);
    failed.searchParams.set("auth", "failed");
    failed.searchParams.set("error", error instanceof Error ? error.message : "OAuth login failed");
    return NextResponse.redirect(failed);
  }
});
