import { NextResponse } from "next/server";
import { handleMcpOAuthCallback, resolveMcpOAuthState } from "@/src/settings/service";

/**
 * COROS requires the OAuth redirect_uri to use the loopback IP (127.0.0.1), not `localhost`, so the
 * callback can land on a different origin than the one the user is browsing and therefore cannot
 * rely on the session cookie. The user is resolved from the OAuth `state` instead, and the browser
 * is redirected back to the origin the flow started from to preserve their session.
 */
export const GET = async (request: Request) => {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const resolved = state ? await resolveMcpOAuthState(state) : null;
  const returnOrigin = resolved?.returnOrigin || url.origin;

  if (!code || !state || !resolved) {
    const failed = new URL("/settings", returnOrigin);
    failed.searchParams.set("auth", "failed");
    failed.searchParams.set("error", !resolved ? "Invalid or expired OAuth state" : "Missing OAuth code or state");
    return NextResponse.redirect(failed);
  }

  try {
    const connection = await handleMcpOAuthCallback(resolved.userId, { code, state, origin: url.origin });
    const settings = new URL("/settings", returnOrigin);
    settings.searchParams.set("mcp", connection);
    settings.searchParams.set("auth", "connected");
    return NextResponse.redirect(settings);
  } catch (error) {
    const failed = new URL("/settings", returnOrigin);
    failed.searchParams.set("auth", "failed");
    failed.searchParams.set("error", error instanceof Error ? error.message : "OAuth login failed");
    return NextResponse.redirect(failed);
  }
};
