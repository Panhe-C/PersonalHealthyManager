import type { Prisma } from "@prisma/client";
import { prisma } from "@/src/db/client";
import { reconcileChecklistCompletion } from "@/src/planning/checklist";

type CompletionItemInput = {
  id?: string;
  label: string;
  status: "pending" | "completed" | "skipped";
};

type StoredChecklistItem = {
  id: string;
  label: string;
  status: string;
};

type AdjustableTask = {
  id?: string;
  title: string;
  trainingType: string;
  durationMinutes: number;
  intensity: string;
  scheduledStart: Date | null;
  scheduledEnd?: Date | null;
};

type TaskAdjustmentChanges = {
  title?: string;
  durationMinutes?: number;
  intensity?: string;
};

function checklistStatus(status: string): CompletionItemInput["status"] {
  return status === "completed" || status === "skipped" ? status : "pending";
}

export function reconcileStoredChecklistItems(
  storedItems: StoredChecklistItem[],
  updates: CompletionItemInput[]
): CompletionItemInput[] {
  const storedIds = new Set(storedItems.map((item) => item.id));
  const updatesById = new Map<string, CompletionItemInput["status"]>();

  for (const update of updates) {
    if (!update.id || !storedIds.has(update.id)) {
      throw new Error("Checklist item does not belong to training task");
    }
    updatesById.set(update.id, update.status);
  }

  return storedItems.map((item) => ({
    id: item.id,
    label: item.label,
    status: updatesById.get(item.id) ?? checklistStatus(item.status)
  }));
}

export function buildChecklistCompletion(input: {
  plannedLoad: number;
  actualLoad?: number;
  linkedActivityId?: string;
  items: CompletionItemInput[];
}) {
  const actualLoad = input.actualLoad === undefined ? undefined : Math.round(input.actualLoad);
  const reconciliation = reconcileChecklistCompletion({
    plannedLoad: input.plannedLoad,
    actualLoad,
    items: input.items
  });

  return {
    completion: {
      status: reconciliation.status,
      plannedVsActualJson: JSON.stringify({
        plannedLoad: input.plannedLoad,
        actualLoad,
        linkedActivityId: input.linkedActivityId,
        remainingLoadAdjustment: reconciliation.remainingLoadAdjustment
      })
    },
    remainingLoadAdjustment: reconciliation.remainingLoadAdjustment,
    adjustment: {
      trigger: "checklist_completion",
      reason: reconciliation.adjustmentReason,
      explanation: reconciliation.adjustmentReason,
      previousStateJson: JSON.stringify({ plannedLoad: input.plannedLoad }),
      newStateJson: JSON.stringify({
        status: reconciliation.status,
        remainingLoadAdjustment: reconciliation.remainingLoadAdjustment
      })
    }
  };
}

function withPrefix(title: string, prefix: string): string {
  return title.startsWith(prefix) ? title : `${prefix}${title}`;
}

export function buildAdjustedTaskUpdate(task: AdjustableTask, changes: TaskAdjustmentChanges) {
  const title = changes.title ?? task.title;
  const scheduledCapacityMinutes =
    task.scheduledStart && task.scheduledEnd
      ? Math.floor((task.scheduledEnd.getTime() - task.scheduledStart.getTime()) / (60 * 1000))
      : undefined;
  const requestedDurationMinutes = changes.durationMinutes ?? task.durationMinutes;
  const durationMinutes =
    changes.durationMinutes !== undefined && scheduledCapacityMinutes !== undefined
      ? Math.min(requestedDurationMinutes, scheduledCapacityMinutes)
      : requestedDurationMinutes;
  const intensity = changes.intensity ?? task.intensity;
  const scheduledEnd = task.scheduledStart
    ? new Date(task.scheduledStart.getTime() + durationMinutes * 60 * 1000)
    : undefined;

  return {
    task: {
      ...changes,
      ...(changes.durationMinutes !== undefined ? { durationMinutes } : {}),
      ...(scheduledEnd ? { scheduledEnd } : {})
    },
    draft: scheduledEnd
      ? {
          title: `Training: ${title}`,
          endsAt: scheduledEnd,
          notes: `Type: ${task.trainingType}. Intensity: ${intensity}.`,
          status: "draft",
          failureReason: null
        }
      : undefined
  };
}

async function updateAdjustedFutureTask(
  tx: Prisma.TransactionClient,
  userId: string,
  task: AdjustableTask & { id: string },
  changes: TaskAdjustmentChanges
) {
  const update = buildAdjustedTaskUpdate(task, changes);

  await tx.trainingTask.update({
    where: { id: task.id },
    data: update.task
  });

  if (update.draft) {
    await tx.calendarEventDraft.updateMany({
      where: {
        trainingTaskId: task.id,
        userId,
        status: { in: ["draft", "confirmed", "failed"] }
      },
      data: update.draft
    });
  }
}

function checklistStateMatches(storedItems: StoredChecklistItem[], items: CompletionItemInput[]): boolean {
  const byId = new Map(items.map((item) => [item.id, item.status]));
  return storedItems.every((item) => byId.get(item.id) === checklistStatus(item.status));
}

export async function completeTrainingTask(
  userId: string,
  taskId: string,
  input: {
    actualLoad?: number;
    perceivedEffort?: string;
    notes?: string;
    linkedActivityId?: string;
    items: CompletionItemInput[];
  }
) {
  return prisma.$transaction(async (tx) => {
    const task = await tx.trainingTask.findFirst({
      where: { id: taskId, userId },
      include: { checklistItems: true, completion: true }
    });

    if (!task) {
      throw new Error("Training task not found");
    }

    const checklistItems = reconcileStoredChecklistItems(task.checklistItems, input.items);

    if (task.completion) {
      if (checklistStateMatches(task.checklistItems, checklistItems)) {
        return tx.trainingTask.findUnique({
          where: { id: task.id },
          include: {
            checklistItems: true,
            completion: true,
            plan: { include: { adjustments: true } }
          }
        });
      }

      throw new Error("Training completion has already been recorded");
    }

    const linkedActivity = input.linkedActivityId
      ? await tx.activityRecord.findFirst({
          where: { id: input.linkedActivityId, userId }
        })
      : null;
    if (input.linkedActivityId && !linkedActivity) {
      throw new Error("Linked activity not found");
    }
    const actualLoad = input.actualLoad ?? linkedActivity?.durationMinutes;

    for (const item of checklistItems) {
      await tx.trainingChecklistItem.update({
        where: { id: item.id },
        data: { status: item.status }
      });
    }

    const built = buildChecklistCompletion({
      plannedLoad: task.durationMinutes,
      actualLoad,
      linkedActivityId: linkedActivity?.id,
      items: checklistItems
    });

    await tx.trainingTask.update({
      where: { id: task.id },
      data: { status: built.completion.status }
    });

    await tx.trainingCompletion.create({
      data: {
        taskId: task.id,
        userId,
        status: built.completion.status,
        perceivedEffort: input.perceivedEffort,
        notes: input.notes,
        linkedActivityId: linkedActivity?.id,
        plannedVsActualJson: built.completion.plannedVsActualJson
      }
    });

    const futureTasks = await tx.trainingTask.findMany({
      where: {
        planId: task.planId,
        userId,
        date: { gt: task.date },
        status: "planned"
      },
      orderBy: { date: "asc" }
    });

    if (built.completion.status === "over_completed") {
      let remainingReduction = Math.abs(built.remainingLoadAdjustment);

      for (const futureTask of futureTasks) {
        const reduction = Math.min(Math.max(0, futureTask.durationMinutes - 20), remainingReduction);
        if (reduction <= 0) continue;

        await updateAdjustedFutureTask(tx, userId, futureTask, {
          intensity: "easy",
          durationMinutes: futureTask.durationMinutes - reduction,
          title: withPrefix(futureTask.title, "Reduced load: ")
        });
        remainingReduction -= reduction;
        if (remainingReduction <= 0) break;
      }
    }

    const nextFutureTask = futureTasks[0];
    if (nextFutureTask && built.completion.status === "skipped") {
      await updateAdjustedFutureTask(tx, userId, nextFutureTask, {
        durationMinutes: nextFutureTask.durationMinutes + Math.min(20, Math.round(task.durationMinutes / 2)),
        title: withPrefix(nextFutureTask.title, "Rescheduled focus: ")
      });
    }

    if (built.completion.status === "partial") {
      for (const [index, futureTask] of futureTasks.entries()) {
        const title = index === 0 ? withPrefix(futureTask.title, "Adjusted after partial completion: ") : futureTask.title;
        const intensity = futureTask.intensity === "hard" ? "moderate" : futureTask.intensity;
        if (title === futureTask.title && intensity === futureTask.intensity) continue;

        await updateAdjustedFutureTask(tx, userId, futureTask, { title, intensity });
      }
    }

    await tx.planAdjustment.create({
      data: {
        planId: task.planId,
        userId,
        ...built.adjustment
      }
    });

    return tx.trainingTask.findUnique({
      where: { id: task.id },
      include: {
        checklistItems: true,
        completion: true,
        plan: { include: { adjustments: true } }
      }
    });
  });
}
