import { NextResponse } from "next/server";
import { withUser } from "@/src/auth/api";
import { confirmCalendarDraft } from "@/src/services/calendarDraftService";

export const POST = withUser(async (user, _request: Request, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  return NextResponse.json(await confirmCalendarDraft(user.id, id));
});
