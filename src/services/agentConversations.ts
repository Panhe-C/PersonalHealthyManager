import { prisma } from "@/src/db/client";

export type AgentConversationSummary = {
  id: string;
  title: string;
  updatedAt: string;
};

export type AgentConversationMessage = {
  id: string;
  role: string;
  content: string;
};

export type AgentConversationDetail = AgentConversationSummary & {
  messages: AgentConversationMessage[];
};

function serializeSummary(conversation: { id: string; title: string; updatedAt: Date }): AgentConversationSummary {
  return {
    id: conversation.id,
    title: conversation.title,
    updatedAt: conversation.updatedAt.toISOString()
  };
}

export function titleFromFirstMessage(message: string) {
  const normalized = message.trim().replace(/\s+/g, " ");
  if (!normalized) return "New conversation";
  return normalized.length > 49 ? `${normalized.slice(0, 46)}...` : normalized;
}

export async function listAgentConversations(userId: string): Promise<AgentConversationSummary[]> {
  const conversations = await prisma.agentConversation.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: 30,
    select: { id: true, title: true, updatedAt: true }
  });

  return conversations.map(serializeSummary);
}

export async function createAgentConversation(userId: string): Promise<AgentConversationDetail> {
  const conversation = await prisma.agentConversation.create({
    data: { userId, title: "New conversation" },
    select: { id: true, title: true, updatedAt: true }
  });

  return { ...serializeSummary(conversation), messages: [] };
}

export async function getAgentConversationForUser(
  userId: string,
  conversationId: string
): Promise<AgentConversationDetail | null> {
  const conversation = await prisma.agentConversation.findFirst({
    where: { id: conversationId, userId },
    select: {
      id: true,
      title: true,
      updatedAt: true,
      messages: {
        orderBy: { createdAt: "asc" },
        take: 100,
        select: { id: true, role: true, content: true }
      }
    }
  });

  if (!conversation) return null;
  return { ...serializeSummary(conversation), messages: conversation.messages };
}

export async function getAgentConversationSummaryForUser(
  userId: string,
  conversationId: string
): Promise<AgentConversationSummary | null> {
  const conversation = await prisma.agentConversation.findFirst({
    where: { id: conversationId, userId },
    select: { id: true, title: true, updatedAt: true }
  });

  return conversation ? serializeSummary(conversation) : null;
}

export async function deleteAgentConversationForUser(userId: string, conversationId: string) {
  const conversation = await prisma.agentConversation.findFirst({
    where: { id: conversationId, userId },
    select: { id: true }
  });

  if (!conversation) return false;

  await prisma.agentConversation.delete({
    where: { id_userId: { id: conversationId, userId } },
    select: { id: true }
  });

  return true;
}

export async function touchAgentConversationAfterMessage(
  userId: string,
  conversationId: string,
  title?: string
): Promise<AgentConversationSummary> {
  const conversation = await prisma.agentConversation.update({
    where: { id_userId: { id: conversationId, userId } },
    data: {
      ...(title ? { title } : {}),
      updatedAt: new Date()
    },
    select: { id: true, title: true, updatedAt: true }
  });

  return serializeSummary(conversation);
}
