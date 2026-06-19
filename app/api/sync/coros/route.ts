import { NextResponse } from "next/server";
import { withUser } from "@/src/auth/api";
import { importCorosPayload, syncCorosFromSettings } from "@/src/services/syncService";

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function hasExplicitPayload(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false;
  return "activities" in payload || "sleep" in payload || "recovery" in payload;
}

export const POST = withUser(async (user, request: Request) => {
  try {
    const payload = await readJson(request);
    const result = hasExplicitPayload(payload) ? await importCorosPayload(user.id, payload) : await syncCorosFromSettings(user.id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "COROS sync failed." }, { status: 400 });
  }
});
