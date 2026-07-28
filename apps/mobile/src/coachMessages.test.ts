import { describe, expect, it } from "vitest";
import type { AgentMessage } from "./api/schemas";
import * as coachMessages from "./coachMessages";

const { getRecentMessagesForChat, mergeConversationMessages } = coachMessages;

describe("coach message state", () => {
  it("keeps optimistic turn messages when stale conversation details arrive", () => {
    const persisted: AgentMessage[] = [{ id: "server-1", role: "assistant", content: "上一条回复" }];
    const current: AgentMessage[] = [
      ...persisted,
      { id: "local-user-1", role: "user", content: "今天训练怎么安排？" },
      { id: "local-assistant-1", role: "assistant", content: "正在整理建议。" }
    ];

    expect(mergeConversationMessages(persisted, current)).toEqual(current);
  });

  it("removes optimistic duplicates once the server has the same turn", () => {
    const persisted: AgentMessage[] = [
      { id: "server-user-1", role: "user", content: "今天训练怎么安排？" },
      { id: "server-assistant-1", role: "assistant", content: "建议低强度训练。" }
    ];
    const current: AgentMessage[] = [
      { id: "local-user-1", role: "user", content: "今天训练怎么安排？" },
      { id: "local-assistant-1", role: "assistant", content: "建议低强度训练。" }
    ];

    expect(mergeConversationMessages(persisted, current).map((message) => message.id)).toEqual([
      "server-user-1",
      "server-assistant-1"
    ]);
  });

  it("keeps recent chat messages in chronological order", () => {
    const messages: AgentMessage[] = Array.from({ length: 10 }, (_, index) => ({
      id: `msg-${index}`,
      role: index % 2 === 0 ? "user" : "assistant",
      content: `message ${index}`
    }));

    expect(getRecentMessagesForChat(messages, 4).map((message) => message.id)).toEqual([
      "msg-6",
      "msg-7",
      "msg-8",
      "msg-9"
    ]);
  });
});
