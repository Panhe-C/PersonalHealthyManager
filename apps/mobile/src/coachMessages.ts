import type { AgentAdjustment, AgentMessage } from "./api/schemas";

function messageKey(message: AgentMessage) {
  return `${message.role}:${message.content}`;
}

function isLocalMessage(message: AgentMessage) {
  return message.id.startsWith("local-");
}

export function mergeConversationMessages(persisted: AgentMessage[], current: AgentMessage[]) {
  const persistedKeys = new Set(persisted.map(messageKey));
  const optimisticMessages = current.filter((message) => isLocalMessage(message) && !persistedKeys.has(messageKey(message)));

  return [...persisted, ...optimisticMessages];
}

export function getRecentMessagesForChat(messages: AgentMessage[], limit = 8) {
  return messages.slice(-limit);
}

export function appendAssistantDelta(messages: AgentMessage[], messageId: string, text: string) {
  return messages.map((message) =>
    message.id === messageId ? { ...message, content: `${message.content}${text}` } : message
  );
}

export function finalizeAssistantMessage(
  messages: AgentMessage[],
  messageId: string,
  final: { message: string; adjustments: AgentAdjustment[] }
) {
  return messages.map((message) =>
    message.id === messageId
      ? { ...message, content: final.message, adjustments: final.adjustments }
      : message
  );
}
