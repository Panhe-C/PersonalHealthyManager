import { NextResponse } from "next/server";
import { completeFeishuCalendarOAuth } from "@/src/services/feishuCalendarOAuthService";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";

  if (!code || !state) {
    return NextResponse.redirect(new URL("/settings?feishu=missing_code", url.origin));
  }

  try {
    await completeFeishuCalendarOAuth({ code, state, origin: url.origin });
    return NextResponse.redirect(new URL("/settings?feishu=connected", url.origin));
  } catch {
    return NextResponse.redirect(new URL("/settings?feishu=failed", url.origin));
  }
}
