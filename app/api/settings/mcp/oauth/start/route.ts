import { NextResponse } from "next/server";
import { withUser } from "@/src/auth/api";
import { createMcpOAuthAuthorizationUrl } from "@/src/settings/service";
import type { DataMcpConnectionId } from "@/src/settings/defaults";

export const GET = withUser(async (user, request: Request) => {
  try {
    const url = new URL(request.url);
    const connection = url.searchParams.get("connection") as DataMcpConnectionId | null;

    if (!connection) {
      return NextResponse.json({ error: "MCP connection is required" }, { status: 400 });
    }

    const authorizationUrl = await createMcpOAuthAuthorizationUrl(user.id, connection, url.origin);
    return NextResponse.redirect(authorizationUrl);
  } catch (error) {
    const url = new URL(request.url);
    const failed = new URL("/settings", url.origin);
    const connection = url.searchParams.get("connection");
    if (connection) failed.searchParams.set("mcp", connection);
    failed.searchParams.set("auth", "failed");
    failed.searchParams.set("error", error instanceof Error ? error.message : "OAuth login could not be started");
    return NextResponse.redirect(failed);
  }
});
