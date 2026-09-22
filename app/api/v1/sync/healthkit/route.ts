import { NextResponse } from "next/server";
import { withUser } from "@/src/auth/api";
import { importHealthKitPayload } from "@/src/services/healthKitService";

export const POST = withUser(async (user, request: Request) => {
  try { return NextResponse.json(await importHealthKitPayload(user.id, await request.json())); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "HealthKit import failed" }, { status: 400 }); }
});
