import { prisma } from "@/src/db/client";
import { writeCalendarDraft, type CalendarWriteDraft, type CalendarWriteResult } from "@/src/providers/calendar-writeback";

export async function listCalendarDrafts(userId: string) {
  return prisma.calendarEventDraft.findMany({
    where: { userId, status: { in: ["draft", "failed", "writing"] } },
    orderBy: { startsAt: "asc" }
  });
}

export async function confirmCalendarDrafts(
  userId: string,
  draftIds: string[],
  writer: (draft: CalendarWriteDraft) => Promise<CalendarWriteResult> = writeCalendarDraft
) {
  const uniqueIds = [...new Set(draftIds)];
  const drafts = await prisma.calendarEventDraft.findMany({
    where: { id: { in: uniqueIds }, userId }
  });

  if (drafts.length !== uniqueIds.length) throw new Error("Draft not found");

  if (drafts.some((draft) => !["draft", "failed", "confirmed"].includes(draft.status))) {
    throw new Error("Draft is not actionable");
  }

  if (drafts.some((draft) => draft.operation === "cancel" && !draft.externalEventId)) {
    throw new Error("Cancellation draft is missing an external event");
  }

  for (const draft of drafts.filter((item) => item.status !== "confirmed")) {
    const claimed = await prisma.calendarEventDraft.updateMany({
      where: { id: draft.id, userId, status: { in: ["draft", "failed"] } },
      data: { status: "writing", failureReason: null }
    });
    if (claimed.count !== 1) throw new Error("Draft is no longer actionable");

    try {
      const result = await writer(draft);
      await prisma.calendarEventDraft.updateMany({
        where: { id: draft.id, userId, status: "writing" },
        data: { status: "confirmed", externalEventId: result.externalEventId, failureReason: null }
      });
    } catch (error) {
      await prisma.calendarEventDraft.updateMany({
        where: { id: draft.id, userId, status: "writing" },
        data: { status: "failed", failureReason: error instanceof Error ? error.message : "Calendar write-back failed" }
      });
    }
  }

  const updated = await prisma.calendarEventDraft.findMany({ where: { id: { in: uniqueIds }, userId } });
  const updatedById = new Map(updated.map((draft) => [draft.id, draft]));
  return uniqueIds.map((id) => updatedById.get(id)!);
}

export async function confirmCalendarDraft(userId: string, draftId: string) {
  const [draft] = await confirmCalendarDrafts(userId, [draftId]);
  return draft;
}
