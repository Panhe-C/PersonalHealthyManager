import { NextResponse } from "next/server";
import { consumeOAuthHandoffToken } from "@/src/auth/oauthHandoff";
import { getCurrentUser } from "@/src/auth/session";
import { buildOAuthReturnUrl, createMcpOAuthAuthorizationUrl, resolvePublicOrigin } from "@/src/settings/service";
import type { DataMcpConnectionId } from "@/src/settings/defaults";

/**
 * Entered by a browser navigation, so it cannot assume the caller carries the
 * native client's Bearer header. The app mints a single-use handoff token and
 * passes it here; everything else falls back to the normal cookie session.
 */
export const GET = async (request: Request) => {
  const url = new URL(request.url);
  const origin = resolvePublicOrigin(request.url);
  const handoff = url.searchParams.get("handoff");
  const returnTarget = handoff ? "app" : "web";

  try {
    const user = handoff ? await consumeOAuthHandoffToken(handoff) : await getCurrentUser();

    if (!user) {
      return NextResponse.redirect(
        buildOAuthReturnUrl(returnTarget, origin, {
          auth: "failed",
          error: handoff ? "Authorization link expired, please try again from the app" : "Unauthorized"
        })
      );
    }

    const connection = url.searchParams.get("connection") as DataMcpConnectionId | null;

    if (!connection) {
      return NextResponse.json({ error: "MCP connection is required" }, { status: 400 });
    }

    const authorizationUrl = await createMcpOAuthAuthorizationUrl(user.id, connection, origin, returnTarget);
    return NextResponse.redirect(authorizationUrl);
  } catch (error) {
    const connection = url.searchParams.get("connection");
    return NextResponse.redirect(
      buildOAuthReturnUrl(returnTarget, origin, {
        ...(connection ? { mcp: connection } : {}),
        auth: "failed",
        error: error instanceof Error ? error.message : "OAuth login could not be started"
      })
    );
  }
};
