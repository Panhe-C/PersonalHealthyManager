import { NextResponse } from "next/server";
import { requireUser } from "@/src/auth/session";
import { listCalendarDrafts } from "@/src/services/calendarDraftService";

export async function GET() {
  const user = await requireUser();
  return NextResponse.json(await listCalendarDrafts(user.id));
}
