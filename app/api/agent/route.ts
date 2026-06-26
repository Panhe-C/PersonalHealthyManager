import { NextResponse } from "next/server";
import { withUser } from "@/src/auth/api";
import { prisma } from "@/src/db/client";
import { createAgentResponse, createAgentResponseForUser } from "@/src/services/agent";
import { buildAgentContext } from "@/src/services/agentContext";
import {
  getAgentConversationSummaryForUser,
  titleFromFirstMessage,
  touchAgentConversationAfterMessage
} from "@/src/services/agentConversations";
import { parseActionProposals } from "@/src/services/agentActions/proposals";
import { agentActionRegistry } from "@/src/services/agentActions/registry";
import { guardAction, type GuardSignals } from "@/src/services/agentActions/safetyGuard";
import { executeAgentAction, type ExecutedAdjustment } from "@/src/services/agentActions/executor";
import type { TimeWindow } from "@/src/domain/models";

async function loadGuardSignals(userId: string, actionId: string, args: Record<string, unknown>): Promise<GuardSignals | null> {
  if (actionId !== "adjust_task_intensity" && actionId !== "reschedule_task") return null;
  const taskId = String(args.taskId ?? "");
  if (!taskId) return null;

  const task = await prisma.trainingTask.findFirst({
    where: { id: taskId, userId },
    include: { plan: true }
  });
  if (!task) return null;

  const [sleep, recovery, calendar] = await Promise.all([
    prisma.sleepRecord.findFirst({ where: { userId }, orderBy: { date: "desc" } }),
    prisma.recoveryRecord.findFirst({ where: { userId }, orderBy: { date: "desc" } }),
    prisma.calendarSnapshot.findFirst({ where: { userId }, orderBy: { capturedAt: "desc" } })
  ]);

  const poorSleep = Boolean(sleep && sleep.qualityScore !== null && sleep.qualityScore < 60);
  const poorRecovery = Boolean(recovery && recovery.recoveryPercent !== null && recovery.recoveryPercent < 60);
  const profile = await prisma.bodyProfile.findUnique({ where: { userId } });
  const injuries = profile ? (JSON.parse(profile.injuriesJson) as string[]) : [];
  const injury = injuries.length > 0;

  let freeWindows: TimeWindow[] = [];
  if (calendar) {
    try {
      freeWindows = JSON.parse(calendar.freeWindowsJson) as TimeWindow[];
    } catch {
      freeWindows = [];
    }
  }

  return {
    poorSleep,
    poorRecovery,
    injury,
    freeWindows,
    taskCurrentIntensity: task.intensity
  };
}

export const POST = withUser(async (user, request: Request) => {
  const body = await request.json();
  const content = String(body.message ?? "").trim();
  const conversationId = String(body.conversationId ?? "").trim();

  if (!content) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }
  if (!conversationId) {
    return NextResponse.json({ error: "Conversation is required" }, { status: 400 });
  }

  const conversation = await getAgentConversationSummaryForUser(user.id, conversationId);
  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const history = await prisma.agentMessage.findMany({
    where: { userId: user.id, conversationId },
    orderBy: { createdAt: "desc" },
    take: 8
  });
  const routed = createAgentResponse(content);
  const agentContext = await buildAgentContext(user.id, routed.intent, content);
  const response = await createAgentResponseForUser(
    user.id,
    content,
    history.reverse().map((message) => ({ role: message.role, content: message.content })),
    agentContext
  );

  const parsed = parseActionProposals(response.message);
  const executed: ExecutedAdjustment[] = [];
  const notes: string[] = [];

  await prisma.agentMessage.create({
    data: { userId: user.id, conversationId, role: "user", content, metadataJson: "{}" }
  });
  const assistantMessage = await prisma.agentMessage.create({
    data: {
      userId: user.id,
      conversationId,
      role: "assistant",
      content: parsed.explanation || response.message,
      metadataJson: JSON.stringify({
        intent: response.intent,
        source: response.source,
        modelProvider: response.modelProvider,
        modelName: response.modelName,
        error: response.error,
        freshSync: agentContext.freshSync,
        contextSections: agentContext.sections.map((section) => section.title),
        proposedActions: parsed.actions.map((action) => action.id),
        warnings: parsed.warnings
      })
    }
  });

  for (const action of parsed.actions) {
    const definition = agentActionRegistry[action.id];
    if (!definition || definition.reversibility === "readonly") continue;
    if (definition.reversibility === "external_irreversible") continue;

    const signals = await loadGuardSignals(user.id, action.id, action.args);
    const guarded = signals
      ? guardAction(action, signals)
      : { accepted: true, args: action.args };

    if (!guarded.accepted) {
      notes.push(`已尝试 ${action.id} 但被安全规则拦下：${guarded.fallbackReason ?? ""}`);
      continue;
    }

    try {
      const adjustment = await executeAgentAction(
        user.id,
        { id: action.id, args: guarded.args },
        assistantMessage.id
      );
      executed.push(adjustment);
      if (guarded.fallbackReason) notes.push(guarded.fallbackReason);
    } catch (error) {
      notes.push(`${action.id} 执行失败：${error instanceof Error ? error.message : "未知错误"}`);
    }
  }

  const finalMessage = [parsed.explanation || response.message, ...notes].filter(Boolean).join("\n");
  if (notes.length > 0) {
    await prisma.agentMessage.update({
      where: { id: assistantMessage.id },
      data: { content: finalMessage }
    });
  }

  const nextTitle = conversation.title === "New conversation" && history.length === 0 ? titleFromFirstMessage(content) : undefined;
  const updatedConversation = await touchAgentConversationAfterMessage(user.id, conversationId, nextTitle);

  return NextResponse.json({
    ...response,
    message: finalMessage,
    conversation: updatedConversation,
    adjustments: executed
  });
});
