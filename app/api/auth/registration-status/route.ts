import { NextResponse } from "next/server";
import { isRegistrationEnabled } from "@/src/auth/registrationPolicy";

export async function GET() {
  return NextResponse.json(
    { registrationEnabled: isRegistrationEnabled() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
