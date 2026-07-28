import { NextResponse } from "next/server";
import { withUser } from "@/src/auth/api";
import { createOAuthHandoffToken, OAUTH_HANDOFF_TTL_MS } from "@/src/auth/oauthHandoff";

/**
 * Mints the single-use token the native client hands to the system browser so a
 * Bearer-authenticated app can start an OAuth login the browser could not
 * otherwise authenticate.
 */
export const POST = withUser(async (user, request: Request) => {
  const url = new URL(request.url);
  const connection = url.searchParams.get("connection") || "coros";

  const handoff = await createOAuthHandoffToken(user.id);
  const startUrl = new URL("/api/settings/mcp/oauth/start", url.origin);
  startUrl.searchParams.set("connection", connection);
  startUrl.searchParams.set("handoff", handoff);

  return NextResponse.json({ url: startUrl.toString(), expiresInMs: OAUTH_HANDOFF_TTL_MS });
});
