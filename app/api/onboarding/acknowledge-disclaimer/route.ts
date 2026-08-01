import { NextResponse } from "next/server";
import { requireUser } from "@/src/auth/session";
import { acknowledgeHealthDisclaimer } from "@/src/services/onboardingService";

export async function POST() {
  const user = await requireUser();
  await acknowledgeHealthDisclaimer(user.id);
  return NextResponse.json({ ok: true });
}
