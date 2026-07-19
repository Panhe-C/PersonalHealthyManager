import { prisma } from "@/src/db/client";
import { loadUserSettings } from "@/src/settings/service";

export async function exportUserData(userId: string) {
  const [account, profile, goals, activities, sleep, recovery, calendars, menus, plans, drafts, conversations, messages, memories, settings, automations] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, email: true, timezone: true, createdAt: true, updatedAt: true } }),
    prisma.bodyProfile.findUnique({ where: { userId } }), prisma.goal.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.activityRecord.findMany({ where: { userId }, orderBy: { startedAt: "asc" } }), prisma.sleepRecord.findMany({ where: { userId }, orderBy: { date: "asc" } }),
    prisma.recoveryRecord.findMany({ where: { userId }, orderBy: { date: "asc" } }), prisma.calendarSnapshot.findMany({ where: { userId }, orderBy: { capturedAt: "asc" } }),
    prisma.mealMenu.findMany({ where: { userId }, orderBy: { date: "asc" } }), prisma.plan.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, include: { trainingTasks: { include: { checklistItems: true, completion: true } } } }),
    prisma.calendarEventDraft.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }), prisma.agentConversation.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.agentMessage.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }), prisma.agentMemory.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    loadUserSettings(userId), prisma.automationState.findMany({ where: { userId }, orderBy: { kind: "asc" } })
  ]);
  return { format: "healthy-body-manager-export", version: 1, exportedAt: new Date().toISOString(), account, profile, goals, activities, sleep, recovery, calendars, menus, plans, calendarDrafts: drafts, agent: { conversations, messages, memories }, settings, automations };
}
