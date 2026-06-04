import { prisma } from "@/src/db/client";
import { reconcileChecklistCompletion } from "@/src/planning/checklist";

type CompletionItemInput = {
  id?: string;
  label: string;
  status: "pending" | "completed" | "skipped";
};

export function buildChecklistCompletion(input: {
  plannedLoad: number;
  actualLoad?: number;
  items: CompletionItemInput[];
}) {
  const reconciliation = reconcileChecklistCompletion({
    plannedLoad: input.plannedLoad,
    actualLoad: input.actualLoad,
    items: input.items
  });

  return {
    completion: {
      status: reconciliation.status,
      plannedVsActualJson: JSON.stringify({
        plannedLoad: input.plannedLoad,
        actualLoad: input.actualLoad,
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

export async function completeTrainingTask(
  userId: string,
  taskId: string,
  input: {
    actualLoad?: number;
    perceivedEffort?: string;
    notes?: string;
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

    for (const item of input.items) {
      if (item.id) {
        await tx.trainingChecklistItem.updateMany({
          where: { id: item.id, taskId },
          data: { status: item.status }
        });
      }
    }

    const built = buildChecklistCompletion({
      plannedLoad: task.durationMinutes,
      actualLoad: input.actualLoad,
      items: input.items
    });
    const statusChanged = task.completion?.status !== built.completion.status;

    await tx.trainingTask.update({
      where: { id: task.id },
      data: { status: built.completion.status }
    });

    await tx.trainingCompletion.upsert({
      where: { taskId: task.id },
      update: {
        status: built.completion.status,
        perceivedEffort: input.perceivedEffort,
        notes: input.notes,
        plannedVsActualJson: built.completion.plannedVsActualJson
      },
      create: {
        taskId: task.id,
        userId,
        status: built.completion.status,
        perceivedEffort: input.perceivedEffort,
        notes: input.notes,
        plannedVsActualJson: built.completion.plannedVsActualJson
      }
    });

    const futureTask = await tx.trainingTask.findFirst({
      where: {
        planId: task.planId,
        userId,
        date: { gt: task.date },
        status: "planned"
      },
      orderBy: { date: "asc" }
    });

    if (futureTask && statusChanged && built.completion.status === "over_completed") {
      await tx.trainingTask.update({
        where: { id: futureTask.id },
        data: {
          intensity: "easy",
          durationMinutes: Math.max(20, futureTask.durationMinutes - 15),
          title: withPrefix(futureTask.title, "Reduced load: ")
        }
      });
    }

    if (futureTask && statusChanged && built.completion.status === "skipped") {
      await tx.trainingTask.update({
        where: { id: futureTask.id },
        data: {
          durationMinutes: futureTask.durationMinutes + Math.min(20, Math.round(task.durationMinutes / 2)),
          title: withPrefix(futureTask.title, "Rescheduled focus: ")
        }
      });
    }

    if (futureTask && statusChanged && built.completion.status === "partial") {
      await tx.trainingTask.update({
        where: { id: futureTask.id },
        data: {
          intensity: futureTask.intensity === "hard" ? "moderate" : futureTask.intensity,
          title: withPrefix(futureTask.title, "Adjusted after partial completion: ")
        }
      });
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
