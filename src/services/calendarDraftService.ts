import { prisma } from "@/src/db/client";

export async function listCalendarDrafts(userId: string) {
  return prisma.calendarEventDraft.findMany({
    where: { userId, status: "draft" },
    orderBy: { startsAt: "asc" }
  });
}

export async function confirmCalendarDrafts(userId: string, draftIds: string[]) {
  const uniqueIds = [...new Set(draftIds)];
  const drafts = await prisma.calendarEventDraft.findMany({
    where: { id: { in: uniqueIds }, userId }
  });

  if (drafts.length !== uniqueIds.length) {
    throw new Error("Draft not found");
  }

  const confirmedById = new Map(drafts.filter((draft) => draft.status === "confirmed").map((draft) => [draft.id, draft]));
  const updates = drafts
    .filter((draft) => draft.status !== "confirmed")
    .map((draft) =>
      prisma.calendarEventDraft.update({
        where: { id: draft.id },
        data: {
          status: "confirmed",
          externalEventId: `mock-feishu-${draft.id}`,
          failureReason: null
        }
      })
    );
  const updated = updates.length > 0 ? await prisma.$transaction(updates) : [];
  const updatedById = new Map(updated.map((draft) => [draft.id, draft]));

  return uniqueIds.map((id) => updatedById.get(id) ?? confirmedById.get(id)!);
}

export async function confirmCalendarDraft(userId: string, draftId: string) {
  const [draft] = await confirmCalendarDrafts(userId, [draftId]);
  return draft;
}
