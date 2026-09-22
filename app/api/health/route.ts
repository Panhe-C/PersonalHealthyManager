import { NextResponse } from "next/server";
import { getServiceHealth } from "@/src/services/healthService";

export const dynamic = "force-dynamic";

export async function GET() {
  const health = await getServiceHealth();
  return NextResponse.json(health, {
    status: health.status === "ok" ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
