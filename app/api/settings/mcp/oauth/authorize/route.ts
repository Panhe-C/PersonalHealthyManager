import { NextResponse } from "next/server";
import { withUser } from "@/src/auth/api";
import type { DataMcpConnectionId } from "@/src/settings/defaults";
import { createMcpOAuthAuthorizationUrl, resolvePublicOrigin } from "@/src/settings/service";

/**
 * Creates the provider authorization URL inside the app's authenticated API
 * request. The native client can therefore open COROS directly instead of
 * opening an HBM handoff page first.
 */
export const POST = withUser(async (user, request: Request) => {
  const requestUrl = new URL(request.url);
  const connection = requestUrl.searchParams.get("connection") as DataMcpConnectionId | null;

  if (!connection) {
    return NextResponse.json({ error: "MCP connection is required" }, { status: 400 });
  }

  const origin = resolvePublicOrigin(request.url);
  const authorizationUrl = await createMcpOAuthAuthorizationUrl(user.id, connection, origin, "app");

  return NextResponse.json({ url: authorizationUrl.toString() });
});
