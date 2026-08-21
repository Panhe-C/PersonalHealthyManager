import { NextResponse } from "next/server";
import { withUser } from "@/src/auth/api";
import { acknowledgeHealthDisclaimer } from "@/src/services/onboardingService";

export const POST = withUser(async (user, _request: Request) => {
  await acknowledgeHealthDisclaimer(user.id);
  return NextResponse.json({ ok: true });
});
