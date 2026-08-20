import { api } from "./client";
import {
  agentResponseSchema,
  conversationDetailSchema,
  conversationListResponseSchema,
  conversationSchema,
  deleteConversationResponseSchema,
  deleteMemoryResponseSchema,
  memoryListResponseSchema,
  memoryWriteResponseSchema,
  undoAdjustmentResponseSchema,
  type AgentResponse,
  type Conversation,
  type ConversationDetail,
  type Memory
} from "./schemas";
import type { AgentAttachment } from "@hbm/contracts";

export type MemoryDraft = {
  kind: string;
  category: string;
  content: string;
};

export function listAgentConversations() {
  return api.get<Conversation[]>("/agent/conversations", conversationListResponseSchema);
}

export function createAgentConversation() {
  return api.post<ConversationDetail>("/agent/conversations", undefined, conversationDetailSchema);
}

export function getAgentConversation(conversationId: string) {
  return api.get<ConversationDetail>(`/agent/conversations/${conversationId}`, conversationDetailSchema);
}

export function deleteAgentConversation(conversationId: string) {
  return api.delete<{ deleted: true }>(`/agent/conversations/${conversationId}`, deleteConversationResponseSchema);
}

export function sendAgentMessage(conversationId: string, message: string, attachments: AgentAttachment[] = []) {
  return api.post<AgentResponse>("/agent", { conversationId, message, ...(attachments.length ? { attachments } : {}) }, agentResponseSchema);
}

export function undoAgentAdjustment(adjustmentId: string) {
  return api.post<{ id: string; undoneAt: string }>(`/agent/adjustments/${adjustmentId}/undo`, undefined, undoAdjustmentResponseSchema);
}

export function listAgentMemories() {
  return api.get<Memory[]>("/agent/memories", memoryListResponseSchema);
}

export function createAgentMemory(draft: MemoryDraft) {
  return api.post<{ memory: Memory }>("/agent/memories", draft, memoryWriteResponseSchema);
}

export function updateAgentMemory(memoryId: string, draft: Partial<MemoryDraft>) {
  return api.patch<{ memory: Memory }>(`/agent/memories/${memoryId}`, draft, memoryWriteResponseSchema);
}

export function deleteAgentMemory(memoryId: string) {
  return api.delete<{ id: string; status: "deleted" }>(`/agent/memories/${memoryId}`, deleteMemoryResponseSchema);
}

export function normalizeConversationSummary(conversation: Conversation) {
  return conversationSchema.parse(conversation);
}
