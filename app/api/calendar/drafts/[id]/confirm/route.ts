import { NextResponse } from "next/server";
import { requireUser } from "@/src/auth/session";
import { confirmCalendarDraft } from "@/src/services/calendarDraftService";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await context.params;
  return NextResponse.json(await confirmCalendarDraft(user.id, id));
}
