import { Prisma } from "@prisma/client";
import { prisma } from "@/src/db/client";
import { sendPushToUser } from "@/src/services/pushService";
import { syncCalendarFromLarkCli, syncCorosFromSettings } from "@/src/services/syncService";

async function runTracked(userId: string, kind: string, operation: () => Promise<unknown>) {
  const startedAt = new Date();
  await prisma.automationState.upsert({
    where: { userId_kind: { userId, kind } },
    update: { status: "running", lastStartedAt: startedAt, lastError: null },
    create: { userId, kind, status: "running", lastStartedAt: startedAt }
  });
  try {
    const result = await operation();
    const completedAt = new Date();
    await prisma.automationState.update({
      where: { userId_kind: { userId, kind } },
      data: { status: "success", lastCompletedAt: completedAt, lastSuccessAt: completedAt, lastError: null, detailsJson: JSON.stringify(result ?? {}) }
    });
    return { kind, status: "success" as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.automationState.update({
      where: { userId_kind: { userId, kind } },
      data: { status: "failed", lastCompletedAt: new Date(), lastError: message }
    });
    return { kind, status: "failed" as const, error: message };
  }
}

export async function sendDueTrainingReminders(userId: string, now = new Date()) {
  const from = new Date(now.getTime() + 20 * 60 * 1000);
  const to = new Date(now.getTime() + 40 * 60 * 1000);
  const tasks = await prisma.trainingTask.findMany({
    where: { userId, scheduledStart: { gte: from, lte: to }, status: { notIn: ["completed", "skipped"] } }
  });
  let sent = 0;
  for (const task of tasks) {
    const dedupeKey = `${task.id}:${task.scheduledStart?.toISOString()}`;
    try {
      const delivery = await prisma.notificationDelivery.create({ data: { userId: task.userId, kind: "training_reminder", dedupeKey } });
      try {
        const result = await sendPushToUser(task.userId, {
          title: "训练即将开始",
          body: `${task.title} 将在约 30 分钟后开始`,
          data: { taskId: task.id }
        });
        if (result.sent === 0) await prisma.notificationDelivery.delete({ where: { id: delivery.id } });
        else sent += result.sent;
      } catch (error) {
        await prisma.notificationDelivery.delete({ where: { id: delivery.id } });
        throw error;
      }
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") continue;
      throw error;
    }
  }
  return { tasks: tasks.length, sent };
}

export async function runAutomationCycle(now = new Date()) {
  const users = await prisma.user.findMany({ select: { id: true } });
  const results = [];
  for (const user of users) {
    results.push(await runTracked(user.id, "coros_sync", () => syncCorosFromSettings(user.id)));
    results.push(await runTracked(user.id, "calendar_sync", () => syncCalendarFromLarkCli(user.id, now)));
    results.push(await runTracked(user.id, "training_reminders", () => sendDueTrainingReminders(user.id, now)));
  }
  return results;
}

export function listAutomationStates(userId: string) {
  return prisma.automationState.findMany({ where: { userId }, orderBy: { kind: "asc" } });
}
