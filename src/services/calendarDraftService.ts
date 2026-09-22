import { prisma } from "@/src/db/client";
import type { CalendarWriteDraft, CalendarWriteResult } from "@/src/providers/calendar-writeback";
import {
  loadUserFeishuCalendarTokens,
  writeCalendarDraftForUser
} from "@/src/services/feishuCalendarOAuthService";

export async function listCalendarDrafts(userId: string) {
  return prisma.calendarEventDraft.findMany({
    where: { userId, status: { in: ["draft", "failed", "writing"] } },
    orderBy: { startsAt: "asc" }
  });
}

/**
 * Write-back prefers per-user Feishu OAuth tokens when present. The legacy
 * lark-cli path still targets the single calendar named by HBM_LARK_CALENDAR_ID
 * under the deployer's login, so without OAuth exactly one named account may
 * use it — and a deployment that has not named one may not use it at all.
 */
export async function assertCalendarWriteAllowed(userId: string): Promise<void> {
  const oauthTokens = await loadUserFeishuCalendarTokens(userId);
  if (oauthTokens) return;

  const allowedEmail = process.env.HBM_LARK_CALENDAR_ACCOUNT_EMAIL?.trim().toLowerCase();

  if (!allowedEmail) {
    throw new Error(
      "Calendar write-back is disabled. Connect Feishu calendar via OAuth, or set HBM_LARK_CALENDAR_ACCOUNT_EMAIL for the single account allowed to use the server lark-cli login."
    );
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (user?.email.trim().toLowerCase() !== allowedEmail) {
    throw new Error("Calendar write-back is not available for this account. Connect Feishu calendar via OAuth.");
  }
}

export async function confirmCalendarDrafts(
  userId: string,
  draftIds: string[],
  writer?: (draft: CalendarWriteDraft) => Promise<CalendarWriteResult>
) {
  await assertCalendarWriteAllowed(userId);
  const effectiveWriter = writer ?? ((draft: CalendarWriteDraft) => writeCalendarDraftForUser(userId, draft));

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
      const result = await effectiveWriter(draft);
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
