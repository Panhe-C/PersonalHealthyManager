import { NextResponse } from "next/server";
import { requireUser } from "@/src/auth/session";
import { importCalendarPayload } from "@/src/services/syncService";

export async function POST(request: Request) {
  const user = await requireUser();
  return NextResponse.json(await importCalendarPayload(user.id, await request.json()));
}
