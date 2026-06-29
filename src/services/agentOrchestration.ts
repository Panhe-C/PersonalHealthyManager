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
import { parseMemoryProposals, stripMemoryBlock } from "@/src/services/agentMemory/memories";
import { applyMemories } from "@/src/services/agentMemory/memoryService";
import { maybeRefreshSummary } from "@/src/services/agentMemory/summaryService";
import type { TimeWindow } from "@/src/domain/models";

const EXPLICIT_MEMORY_PATTERN = /记住|记下|别忘了|记一下|帮我记|remember(?:\s+to)?/i;

export interface AgentMessageResult {
  status: number;
  body: unknown;
}

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

/**
 * Orchestrates a single agent turn: load conversation + history, ask the model,
 * parse proposed actions/memories, execute reversible actions under the safety
 * guard, apply memories, persist messages, refresh the rolling summary, and
 * touch the conversation. Extracted from `app/api/agent/route.ts` so both
 * `/api/agent` and `/api/v1/agent` can share it without duplicating logic.
 */
export async function handleAgentMessage(
  userId: string,
  body: unknown
): Promise<AgentMessageResult> {
  const payload = (body ?? {}) as Record<string, unknown>;
  const content = String(payload.message ?? "").trim();
  const conversationId = String(payload.conversationId ?? "").trim();

  if (!content) {
    return { status: 400, body: { error: "Message is required" } };
  }
  if (!conversationId) {
    return { status: 400, body: { error: "Conversation is required" } };
  }

  const conversation = await getAgentConversationSummaryForUser(userId, conversationId);
  if (!conversation) {
    return { status: 404, body: { error: "Conversation not found" } };
  }

  const history = await prisma.agentMessage.findMany({
    where: { userId, conversationId },
    orderBy: { createdAt: "desc" },
    take: 8
  });
  const routed = createAgentResponse(content);
  const agentContext = await buildAgentContext(userId, routed.intent, content, conversationId);
  const response = await createAgentResponseForUser(
    userId,
    content,
    history.reverse().map((message) => ({ role: message.role, content: message.content })),
    agentContext
  );

  const parsed = parseActionProposals(response.message);
  const memoryParsed = parseMemoryProposals(response.message);
  const explanation = stripMemoryBlock(parsed.explanation || response.message);
  const executed: ExecutedAdjustment[] = [];
  const notes: string[] = [];

  await prisma.agentMessage.create({
    data: { userId, conversationId, role: "user", content, metadataJson: "{}" }
  });
  const assistantMessage = await prisma.agentMessage.create({
    data: {
      userId,
      conversationId,
      role: "assistant",
      content: explanation,
      metadataJson: JSON.stringify({
        intent: response.intent,
        source: response.source,
        modelProvider: response.modelProvider,
        modelName: response.modelName,
        error: response.error,
        freshSync: agentContext.freshSync,
        contextSections: agentContext.sections.map((section) => section.title),
        proposedActions: parsed.actions.map((action) => action.id),
        proposedMemories: memoryParsed.memories.map((memory) => `${memory.op}:${memory.content}`),
        warnings: [...parsed.warnings, ...memoryParsed.warnings]
      })
    }
  });

  for (const action of parsed.actions) {
    const definition = agentActionRegistry[action.id];
    if (!definition || definition.reversibility === "readonly") continue;
    if (definition.reversibility === "external_irreversible") continue;

    const signals = await loadGuardSignals(userId, action.id, action.args);
    const guarded = signals
      ? guardAction(action, signals)
      : { accepted: true, args: action.args };

    if (!guarded.accepted) {
      notes.push(`已尝试 ${action.id} 但被安全规则拦下：${guarded.fallbackReason ?? ""}`);
      continue;
    }

    try {
      const adjustment = await executeAgentAction(
        userId,
        { id: action.id, args: guarded.args },
        assistantMessage.id
      );
      executed.push(adjustment);
      if (guarded.fallbackReason) notes.push(guarded.fallbackReason);
    } catch (error) {
      notes.push(`${action.id} 执行失败：${error instanceof Error ? error.message : "未知错误"}`);
    }
  }

  const memorySource = EXPLICIT_MEMORY_PATTERN.test(content) ? "explicit" : "auto";
  let appliedMemories: Awaited<ReturnType<typeof applyMemories>>["applied"] = [];
  let memoryWarnings: string[] = [];
  if (memoryParsed.memories.length > 0) {
    try {
      const outcome = await applyMemories(userId, memoryParsed.memories, {
        messageId: assistantMessage.id,
        conversationId,
        source: memorySource
      });
      appliedMemories = outcome.applied;
      memoryWarnings = outcome.warnings;
      for (const applied of appliedMemories) {
        if (memorySource === "explicit" && (applied.status === "created" || applied.status === "superseded")) {
          notes.push(`已记住：${applied.content}`);
        }
      }
    } catch (error) {
      memoryWarnings.push(`memory apply failed: ${error instanceof Error ? error.message : "未知错误"}`);
    }
  }

  const finalMessage = [explanation, ...notes].filter(Boolean).join("\n");
  await prisma.agentMessage.update({
    where: { id: assistantMessage.id },
    data: {
      content: finalMessage,
      metadataJson: JSON.stringify({
        intent: response.intent,
        source: response.source,
        modelProvider: response.modelProvider,
        modelName: response.modelName,
        error: response.error,
        freshSync: agentContext.freshSync,
        contextSections: agentContext.sections.map((section) => section.title),
        proposedActions: parsed.actions.map((action) => action.id),
        proposedMemories: memoryParsed.memories.map((memory) => `${memory.op}:${memory.content}`),
        appliedMemories: appliedMemories.map((applied) => `${applied.op}:${applied.status}:${applied.content}`),
        warnings: [...parsed.warnings, ...memoryParsed.warnings, ...memoryWarnings]
      })
    }
  });

  try {
    await maybeRefreshSummary(userId, conversationId);
  } catch {
    // ignore summary failures
  }

  const nextTitle = conversation.title === "New conversation" && history.length === 0 ? titleFromFirstMessage(content) : undefined;
  const updatedConversation = await touchAgentConversationAfterMessage(userId, conversationId, nextTitle);

  return {
    status: 200,
    body: {
      ...response,
      message: finalMessage,
      conversation: updatedConversation,
      adjustments: executed,
      appliedMemories
    }
  };
}
