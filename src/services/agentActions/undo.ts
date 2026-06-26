import { prisma } from "@/src/db/client";
import {
  restoreStatementsFromSnapshot,
  type ActionSnapshot
} from "@/src/services/agentActions/snapshot";

export type UndoOutcome = { ok: true } | { ok: false; status: number; error: string };

export async function undoAgentAdjustment(userId: string, adjustmentId: string): Promise<UndoOutcome> {
  const adjustment = await prisma.planAdjustment.findFirst({
    where: { id: adjustmentId, userId, trigger: "agent" },
    include: { plan: { select: { status: true } } }
  });

  if (!adjustment || !adjustment.undoable) {
    return { ok: false, status: 404, error: "Adjustment not found" };
  }
  if (adjustment.undoneAt) {
    return { ok: false, status: 409, error: "Adjustment already undone" };
  }
  if (adjustment.plan.status === "superseded") {
    return { ok: false, status: 409, error: "该调整已过期，无法撤销" };
  }

  const snapshot = JSON.parse(adjustment.previousStateJson) as ActionSnapshot;
  const statements = restoreStatementsFromSnapshot(snapshot);

  return prisma.$transaction(async (tx) => {
    for (const task of statements.tasks) {
      const current = await tx.trainingTask.findFirst({
        where: { id: task.id, userId },
        include: { completion: true }
      });
      if (current && (current.completion || (current.status !== "planned" && current.status !== "skipped"))) {
        return { ok: false, status: 409, error: "部分任务已开始，无法整体撤销" } as UndoOutcome;
      }
    }

    for (const task of statements.tasks) {
      await tx.trainingTask.update({ where: { id: task.id }, data: task.data });
    }
    for (const draft of statements.drafts) {
      await tx.calendarEventDraft.updateMany({ where: { id: draft.id, userId }, data: draft.data });
    }

    if (snapshot.planIds?.created) {
      await tx.plan.updateMany({
        where: { id: snapshot.planIds.created, userId },
        data: { status: "superseded" }
      });
    }

    await tx.planAdjustment.update({ where: { id: adjustmentId }, data: { undoneAt: new Date() } });
    return { ok: true } as UndoOutcome;
  });
}
