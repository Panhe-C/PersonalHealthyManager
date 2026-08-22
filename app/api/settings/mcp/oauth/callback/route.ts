import { NextResponse } from "next/server";
import { buildOAuthReturnUrl, handleMcpOAuthCallback, resolveMcpOAuthState, resolvePublicOrigin } from "@/src/settings/service";

/**
 * COROS requires the OAuth redirect_uri to use the loopback IP (127.0.0.1), not `localhost`, so the
 * callback can land on a different origin than the one the user is browsing and therefore cannot
 * rely on the session cookie. The user is resolved from the OAuth `state` instead, and the browser
 * is redirected back to wherever the flow started: the web settings page, or the app deep link when
 * the flow was launched from the native client.
 */
export const GET = async (request: Request) => {
  const url = new URL(request.url);
  const origin = resolvePublicOrigin(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const resolved = state ? await resolveMcpOAuthState(state) : null;
  const returnOrigin = resolved?.returnOrigin || origin;
  const returnTarget = resolved?.returnTarget ?? "web";

  if (!code || !state || !resolved) {
    return NextResponse.redirect(
      buildOAuthReturnUrl(returnTarget, returnOrigin, {
        auth: "failed",
        error: !resolved ? "Invalid or expired OAuth state" : "Missing OAuth code or state"
      })
    );
  }

  try {
    const connection = await handleMcpOAuthCallback(resolved.userId, { code, state, origin });
    return NextResponse.redirect(
      buildOAuthReturnUrl(returnTarget, returnOrigin, { mcp: connection, auth: "connected" })
    );
  } catch (error) {
    return NextResponse.redirect(
      buildOAuthReturnUrl(returnTarget, returnOrigin, {
        auth: "failed",
        error: error instanceof Error ? error.message : "OAuth login failed"
      })
    );
  }
};
