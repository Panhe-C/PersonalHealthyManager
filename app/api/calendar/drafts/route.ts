import { NextResponse } from "next/server";
import { withUser } from "@/src/auth/api";
import { confirmCalendarDrafts, listCalendarDrafts } from "@/src/services/calendarDraftService";

export const GET = withUser(async (user) => {
  return NextResponse.json(await listCalendarDrafts(user.id));
});

export const POST = withUser(async (user, request: Request) => {
  const body = await request.json();
  const ids = Array.isArray(body.ids) ? body.ids.map(String) : [];

  if (ids.length === 0) {
    return NextResponse.json({ error: "At least one draft is required" }, { status: 400 });
  }

  return NextResponse.json(await confirmCalendarDrafts(user.id, ids));
});
