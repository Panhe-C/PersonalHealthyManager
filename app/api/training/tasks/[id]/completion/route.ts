import { NextResponse } from "next/server";
import { withUser } from "@/src/auth/api";
import { trainingCompletionSchema } from "@/src/domain/validation";
import { completeTrainingTask } from "@/src/services/checklistService";

export const POST = withUser(async (user, request: Request, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  const parsed = trainingCompletionSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid training completion" }, { status: 400 });
  }

  const task = await completeTrainingTask(user.id, id, {
    actualLoad: parsed.data.actualLoad,
    perceivedEffort: parsed.data.perceivedEffort,
    notes: parsed.data.notes,
    linkedActivityId: parsed.data.linkedActivityId,
    items: parsed.data.items
  });

  return NextResponse.json(task);
});
