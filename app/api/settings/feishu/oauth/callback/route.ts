import { NextResponse } from "next/server";
import { resolvePublicOrigin } from "@/src/settings/service";
import { completeFeishuCalendarOAuth } from "@/src/services/feishuCalendarOAuthService";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = resolvePublicOrigin(request.url);
  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";

  if (!code || !state) {
    return NextResponse.redirect(new URL("/settings?feishu=missing_code", origin));
  }

  try {
    await completeFeishuCalendarOAuth({ code, state, origin });
    return NextResponse.redirect(new URL("/settings?feishu=connected", origin));
  } catch {
    return NextResponse.redirect(new URL("/settings?feishu=failed", origin));
  }
}
