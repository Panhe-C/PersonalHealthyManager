import { prisma } from "@/src/db/client";

export async function listCalendarDrafts(userId: string) {
  return prisma.calendarEventDraft.findMany({
    where: { userId },
    orderBy: { startsAt: "asc" }
  });
}

export async function confirmCalendarDraft(userId: string, draftId: string) {
  const draft = await prisma.calendarEventDraft.findFirst({
    where: { id: draftId, userId }
  });

  if (!draft) {
    throw new Error("Draft not found");
  }

  if (draft.status === "confirmed") {
    return draft;
  }

  return prisma.calendarEventDraft.update({
    where: { id: draft.id },
    data: {
      status: "confirmed",
      externalEventId: `mock-feishu-${draft.id}`,
      failureReason: null
    }
  });
}
