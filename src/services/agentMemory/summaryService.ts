import { prisma } from "@/src/db/client";
import { loadModelRuntimeConfig, type ModelRuntimeConfig } from "@/src/settings/service";
import { runModelCompletion, type ModelChatMessage } from "@/src/services/agent";

const REFRESH_THRESHOLD = 6;
const MESSAGE_WINDOW = 50;

export type SummaryRefreshOutcome = {
  refreshed: boolean;
  reason?: string;
};

function summarySystemPrompt(existingSummary: string | null) {
  return [
    "You are summarizing a personal health management conversation for long-term memory.",
    "Produce a concise rolling summary (<= 250 words) capturing durable facts, decisions, and preferences the user expressed.",
    "Drop transient small talk and one-off status updates.",
    "If a previous summary exists, fold it into the new summary; do not lose earlier facts.",
    "Answer in the user's language. Output only the summary text, no markdown headings."
  ]
    .filter(Boolean)
    .join("\n")
    .concat(existingSummary ? `\n\nPrevious summary:\n${existingSummary}` : "");
}

function renderMessagesForSummary(messages: Array<{ role: string; content: string }>): ModelChatMessage[] {
  return messages
    .filter((item) => ["user", "assistant"].includes(item.role) && item.content.trim())
    .map((item) => ({ role: item.role as "user" | "assistant", content: item.content.trim() }));
}

async function refreshSummary(
  config: ModelRuntimeConfig,
  conversationId: string,
  existingSummary: string | null,
  messages: Array<{ role: string; content: string }>,
  currentCount: number
): Promise<void> {
  const chatMessages = renderMessagesForSummary(messages);
  if (chatMessages.length === 0) return;

  const summary = await runModelCompletion(
    config,
    summarySystemPrompt(existingSummary),
    chatMessages,
    { maxTokens: 800 }
  );

  const trimmed = summary.trim();
  if (!trimmed) return;

  await prisma.agentConversation.update({
    where: { id: conversationId },
    data: {
      summary: trimmed,
      summaryUpdatedAt: new Date(),
      summaryMessageCount: currentCount
    }
  });
}

export async function maybeRefreshSummary(
  userId: string,
  conversationId: string,
  options: { threshold?: number; config?: ModelRuntimeConfig | null } = {}
): Promise<SummaryRefreshOutcome> {
  const threshold = options.threshold ?? REFRESH_THRESHOLD;

  const conversation = await prisma.agentConversation.findFirst({
    where: { id: conversationId, userId },
    select: { id: true, summary: true, summaryMessageCount: true }
  });
  if (!conversation) return { refreshed: false, reason: "conversation not found" };

  const messageCount = await prisma.agentMessage.count({
    where: { userId, conversationId }
  });

  const delta = messageCount - conversation.summaryMessageCount;
  if (delta < threshold) {
    return { refreshed: false, reason: "below threshold" };
  }
  if (messageCount === 0) return { refreshed: false, reason: "no messages" };

  const config = options.config !== undefined ? options.config : await loadModelRuntimeConfig(userId);
  if (!config) return { refreshed: false, reason: "no model configured" };

  const messages = await prisma.agentMessage.findMany({
    where: { userId, conversationId },
    orderBy: { createdAt: "asc" },
    take: MESSAGE_WINDOW,
    select: { role: true, content: true }
  });

  try {
    await refreshSummary(config, conversation.id, conversation.summary, messages, messageCount);
    return { refreshed: true };
  } catch {
    return { refreshed: false, reason: "summary model call failed" };
  }
}

export async function loadConversationSummaryForContext(
  userId: string,
  conversationId: string
): Promise<string | null> {
  const conversation = await prisma.agentConversation.findFirst({
    where: { id: conversationId, userId },
    select: { summary: true }
  });
  return conversation?.summary ?? null;
}

export async function loadRecentConversationSummaries(
  userId: string,
  excludeConversationId: string,
  limit = 3
): Promise<Array<{ title: string; summary: string }>> {
  const conversations = await prisma.agentConversation.findMany({
    where: { userId, id: { not: excludeConversationId }, summary: { not: null } },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: { title: true, summary: true }
  });
  return conversations
    .filter((conversation) => conversation.summary)
    .map((conversation) => ({ title: conversation.title, summary: conversation.summary as string }));
}
