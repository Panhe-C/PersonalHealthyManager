import type { Prisma } from "@prisma/client";
import { prisma } from "@/src/db/client";
import { buildAdjustedTaskUpdate } from "@/src/services/checklistService";
import { generatePlanForUser } from "@/src/services/planService";
import {
  serializeSnapshot,
  type AffectedRows,
  type ActionSnapshot
} from "@/src/services/agentActions/snapshot";
import type { AgentActionProposal } from "@/src/services/agentActions/proposals";

export type ExecutedAdjustment = { id: string; label: string; undoneAt: string | null };

type TaskRow = Prisma.TrainingTaskGetPayload<{}> & { calendarDraft?: { id: string } | null };

function taskToAffected(task: TaskRow): AffectedRows["tasks"][number] {
  return {
    id: task.id,
    intensity: task.intensity,
    durationMinutes: task.durationMinutes,
    title: task.title,
    date: task.date,
    scheduledStart: task.scheduledStart,
    scheduledEnd: task.scheduledEnd,
    status: task.status
  };
}

function draftToAffected(draft: {
  id: string;
  title: string;
  startsAt: Date | null;
  endsAt: Date | null;
  notes: string;
  status: string;
  failureReason: string | null;
}): AffectedRows["drafts"][number] {
  return {
    id: draft.id,
    title: draft.title,
    startsAt: draft.startsAt,
    endsAt: draft.endsAt,
    notes: draft.notes,
    status: draft.status,
    failureReason: draft.failureReason
  };
}

async function loadTaskWithDraft(tx: Prisma.TransactionClient, userId: string, taskId: string) {
  return tx.trainingTask.findFirst({
    where: { id: taskId, userId },
    include: { calendarDraft: { select: { id: true } } }
  });
}

async function loadDraftForTask(tx: Prisma.TransactionClient, userId: string, taskId: string) {
  return tx.calendarEventDraft.findFirst({ where: { trainingTaskId: taskId, userId } });
}

async function collectAffectedRows(
  tx: Prisma.TransactionClient,
  userId: string,
  action: AgentActionProposal
): Promise<AffectedRows> {
  if (action.id === "skip_task") {
    const target = await loadTaskWithDraft(tx, userId, String(action.args.taskId));
    if (!target) return { tasks: [], drafts: [] };

    const futureTasks = await tx.trainingTask.findMany({
      where: { planId: target.planId, userId, date: { gt: target.date }, status: "planned" },
      include: { calendarDraft: { select: { id: true } } },
      orderBy: { date: "asc" }
    });

    const tasks = [target, ...futureTasks].map(taskToAffected);
    const drafts: AffectedRows["drafts"] = [];
    for (const task of [target, ...futureTasks]) {
      if (task.calendarDraft) {
        const draft = await loadDraftForTask(tx, userId, task.id);
        if (draft) drafts.push(draftToAffected(draft));
      }
    }
    return { tasks, drafts };
  }

  if (action.id === "adjust_task_intensity" || action.id === "reschedule_task") {
    const target = await loadTaskWithDraft(tx, userId, String(action.args.taskId));
    if (!target) return { tasks: [], drafts: [] };
    const tasks = [taskToAffected(target)];
    const drafts: AffectedRows["drafts"] = [];
    if (target.calendarDraft) {
      const draft = await loadDraftForTask(tx, userId, target.id);
      if (draft) drafts.push(draftToAffected(draft));
    }
    return { tasks, drafts };
  }

  return { tasks: [], drafts: [] };
}

async function applyAdjustIntensity(
  tx: Prisma.TransactionClient,
  userId: string,
  action: AgentActionProposal
) {
  const task = await loadTaskWithDraft(tx, userId, String(action.args.taskId));
  if (!task) throw new Error("Training task not found");

  const update = buildAdjustedTaskUpdate(
    {
      id: task.id,
      title: task.title,
      trainingType: task.trainingType,
      durationMinutes: task.durationMinutes,
      intensity: task.intensity,
      scheduledStart: task.scheduledStart,
      scheduledEnd: task.scheduledEnd
    },
    { intensity: String(action.args.intensity) }
  );

  await tx.trainingTask.update({ where: { id: task.id }, data: update.task });
  if (update.draft) {
    await tx.calendarEventDraft.updateMany({
      where: { trainingTaskId: task.id, userId, status: { in: ["draft", "confirmed", "failed"] } },
      data: update.draft
    });
  }

  return {
    planId: task.planId,
    label: `已将训练强度调整为 ${action.args.intensity}`,
    reason: `Agent adjusted intensity to ${action.args.intensity}.`
  };
}

async function applyReschedule(
  tx: Prisma.TransactionClient,
  userId: string,
  action: AgentActionProposal
) {
  const task = await loadTaskWithDraft(tx, userId, String(action.args.taskId));
  if (!task) throw new Error("Training task not found");

  const newStart = new Date(String(action.args.newStart));
  const newEnd = task.scheduledStart
    ? new Date(newStart.getTime() + task.durationMinutes * 60 * 1000)
    : null;

  await tx.trainingTask.update({
    where: { id: task.id },
    data: { scheduledStart: newStart, ...(newEnd ? { scheduledEnd: newEnd } : {}) }
  });

  if (task.calendarDraft) {
    await tx.calendarEventDraft.updateMany({
      where: { trainingTaskId: task.id, userId, status: { in: ["draft", "confirmed", "failed"] } },
      data: { startsAt: newStart, ...(newEnd ? { endsAt: newEnd } : {}) }
    });
  }

  return {
    planId: task.planId,
    label: `已将训练挪到 ${newStart.toLocaleString("zh-CN")}`,
    reason: `Agent rescheduled task to ${newStart.toISOString()}.`
  };
}

async function applySkip(
  tx: Prisma.TransactionClient,
  userId: string,
  action: AgentActionProposal
) {
  const task = await loadTaskWithDraft(tx, userId, String(action.args.taskId));
  if (!task) throw new Error("Training task not found");

  await tx.trainingTask.update({ where: { id: task.id }, data: { status: "skipped" } });
  if (task.calendarDraft) {
    await tx.calendarEventDraft.updateMany({
      where: { trainingTaskId: task.id, userId, status: { in: ["draft", "confirmed", "failed"] } },
      data: { status: "superseded" }
    });
  }

  const futureTasks = await tx.trainingTask.findMany({
    where: { planId: task.planId, userId, date: { gt: task.date }, status: "planned" },
    include: { calendarDraft: { select: { id: true } } },
    orderBy: { date: "asc" }
  });

  const nextTask = futureTasks[0];
  if (nextTask) {
    const addedMinutes = Math.min(20, Math.round(task.durationMinutes / 2));
    const update = buildAdjustedTaskUpdate(
      {
        id: nextTask.id,
        title: nextTask.title,
        trainingType: nextTask.trainingType,
        durationMinutes: nextTask.durationMinutes,
        intensity: nextTask.intensity,
        scheduledStart: nextTask.scheduledStart,
        scheduledEnd: nextTask.scheduledEnd
      },
      {
        durationMinutes: nextTask.durationMinutes + addedMinutes,
        title: nextTask.title.startsWith("Rescheduled focus: ")
          ? nextTask.title
          : `Rescheduled focus: ${nextTask.title}`
      }
    );
    await tx.trainingTask.update({ where: { id: nextTask.id }, data: update.task });
    if (update.draft && nextTask.calendarDraft) {
      await tx.calendarEventDraft.updateMany({
        where: { trainingTaskId: nextTask.id, userId, status: { in: ["draft", "confirmed", "failed"] } },
        data: update.draft
      });
    }
  }

  return {
    planId: task.planId,
    label: "已跳过该训练并保守重排后续任务",
    reason: String(action.args.reason ?? "Agent skipped task.")
  };
}

async function applyAction(
  tx: Prisma.TransactionClient,
  userId: string,
  action: AgentActionProposal
): Promise<{ planId: string; label: string; reason: string; planIds?: { superseded?: string; created?: string } }> {
  if (action.id === "adjust_task_intensity") return applyAdjustIntensity(tx, userId, action);
  if (action.id === "reschedule_task") return applyReschedule(tx, userId, action);
  if (action.id === "skip_task") return applySkip(tx, userId, action);
  throw new Error(`Action ${action.id} is not executable via executor`);
}

export async function executeAgentAction(
  userId: string,
  action: AgentActionProposal,
  messageId: string
): Promise<ExecutedAdjustment> {
  if (action.id === "regenerate_plan") {
    const weekStart = new Date(String(action.args.weekStart));
    const plan = await generatePlanForUser(userId, weekStart);
    const adjustment = await prisma.planAdjustment.create({
      data: {
        planId: plan!.id,
        userId,
        trigger: "agent",
        actionId: action.id,
        messageId,
        undoable: true,
        previousStateJson: JSON.stringify({ tasks: [], drafts: [], planIds: {} }),
        newStateJson: JSON.stringify({ tasks: [], drafts: [], planIds: { created: plan!.id } }),
        reason: "Agent regenerated weekly plan.",
        explanation: "已重新生成本周计划"
      }
    });
    return { id: adjustment.id, label: "已重新生成本周计划", undoneAt: null };
  }

  return prisma.$transaction(async (tx) => {
    const before = await collectAffectedRows(tx, userId, action);
    const applied = await applyAction(tx, userId, action);
    const after = await collectAffectedRows(tx, userId, action);

    const adjustment = await tx.planAdjustment.create({
      data: {
        planId: applied.planId,
        userId,
        trigger: "agent",
        actionId: action.id,
        messageId,
        undoable: true,
        previousStateJson: JSON.stringify(serializeSnapshot(before)),
        newStateJson: JSON.stringify(serializeSnapshot(after) as ActionSnapshot),
        reason: applied.reason,
        explanation: applied.label
      }
    });

    return { id: adjustment.id, label: applied.label, undoneAt: null };
  });
}
