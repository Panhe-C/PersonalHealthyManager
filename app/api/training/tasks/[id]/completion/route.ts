import { NextResponse } from "next/server";
import { requireUser } from "@/src/auth/session";
import { completeTrainingTask } from "@/src/services/checklistService";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await context.params;
  const body = await request.json();
  const task = await completeTrainingTask(user.id, id, {
    actualLoad: body.actualLoad,
    perceivedEffort: body.perceivedEffort,
    notes: body.notes,
    items: Array.isArray(body.items) ? body.items : []
  });

  return NextResponse.json(task);
}
