import { prisma } from "@/src/db/client";

export async function listCalendarDrafts(userId: string) {
  return prisma.calendarEventDraft.findMany({
    where: { userId, status: "draft" },
    orderBy: { startsAt: "asc" }
  });
}

export async function confirmCalendarDrafts(userId: string, draftIds: string[]) {
  const uniqueIds = [...new Set(draftIds)];

  return prisma.$transaction(async (tx) => {
    const drafts = await tx.calendarEventDraft.findMany({
      where: { id: { in: uniqueIds }, userId }
    });

    if (drafts.length !== uniqueIds.length) {
      throw new Error("Draft not found");
    }

    if (drafts.some((draft) => !["draft", "failed", "confirmed"].includes(draft.status))) {
      throw new Error("Draft is not actionable");
    }

    if (drafts.some((draft) => draft.operation === "cancel" && !draft.externalEventId)) {
      throw new Error("Cancellation draft is missing an external event");
    }

    const actionableDrafts = drafts.filter((draft) => draft.status !== "confirmed");
    if (actionableDrafts.length === 0) {
      return drafts;
    }

    for (const draft of actionableDrafts) {
      const result = await tx.calendarEventDraft.updateMany({
        where: {
          id: draft.id,
          userId,
          status: { in: ["draft", "failed"] }
        },
        data: {
          status: "confirmed",
          externalEventId: draft.operation === "cancel" ? null : draft.externalEventId ?? `mock-feishu-${draft.id}`,
          failureReason: null
        }
      });

      if (result.count !== 1) {
        throw new Error("Draft is no longer actionable");
      }
    }

    const updated = await tx.calendarEventDraft.findMany({
      where: { id: { in: uniqueIds }, userId }
    });
    const updatedById = new Map(updated.map((draft) => [draft.id, draft]));

    return uniqueIds.map((id) => updatedById.get(id)!);
  });
}

export async function confirmCalendarDraft(userId: string, draftId: string) {
  const [draft] = await confirmCalendarDrafts(userId, [draftId]);
  return draft;
}
