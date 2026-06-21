import { NextResponse } from "next/server";
import { withUser } from "@/src/auth/api";
import { prepareCorosMcpConnectionForOAuth } from "@/src/settings/service";
import type { CorosMcpRegion } from "@/src/settings/defaults";

export const POST = withUser(async (user, request: Request) => {
  try {
    const body = (await request.json()) as { endpoint?: unknown; corosRegion?: unknown };
    const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
    const corosRegion =
      typeof body.corosRegion === "string" && body.corosRegion ? (body.corosRegion as CorosMcpRegion) : undefined;

    await prepareCorosMcpConnectionForOAuth(user.id, { endpoint, corosRegion });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not prepare COROS connection." },
      { status: 400 }
    );
  }
});
