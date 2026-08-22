import { NextResponse } from "next/server";
import { withUser } from "@/src/auth/api";
import { resolvePublicOrigin } from "@/src/settings/service";
import { startFeishuCalendarOAuth } from "@/src/services/feishuCalendarOAuthService";

export const POST = withUser(async (user, request: Request) => {
  try {
    const origin = resolvePublicOrigin(request.url);
    const url = await startFeishuCalendarOAuth(user.id, origin);
    return NextResponse.json({ ok: true, authorizeUrl: url.toString() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not start Feishu OAuth" },
      { status: 400 }
    );
  }
});
