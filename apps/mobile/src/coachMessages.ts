import type { AgentMessage } from "./api/schemas";

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

export function formatCoachMessage(content: string) {
  return content
    .replace(/\*\*/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*\|?[-:\s|]+\|?\s*$/gm, "")
    .replace(/^\s*\|\s?/gm, "")
    .replace(/\s?\|\s*$/gm, "")
    .replace(/\s*\|\s*/g, " · ")
    .replace(/^\s*-\s+/gm, "• ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
