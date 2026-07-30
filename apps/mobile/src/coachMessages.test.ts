import { describe, expect, it } from "vitest";
import type { AgentFinalPayload } from "@hbm/contracts";
import type { AgentMessage } from "./api/schemas";
import * as coachMessages from "./coachMessages";

const {
  appendAssistantDelta,
  finalizeAssistantMessage,
  getRecentMessagesForChat,
  mergeConversationMessages
} = coachMessages;

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

  it("appends stream deltas to the same optimistic assistant message", () => {
    const messages: AgentMessage[] = [
      { id: "local-assistant-1", role: "assistant", content: "建议" }
    ];

    expect(appendAssistantDelta(messages, "local-assistant-1", "恢复跑。")).toEqual([
      { id: "local-assistant-1", role: "assistant", content: "建议恢复跑。" }
    ]);
  });

  it("reconciles the optimistic assistant message from the final event", () => {
    const messages: AgentMessage[] = [
      { id: "local-assistant-1", role: "assistant", content: "建议恢复" }
    ];
    const final: AgentFinalPayload = {
      message: "建议恢复跑。",
      intent: "general",
      source: "model",
      conversation: {
        id: "conv-1",
        title: "训练建议",
        updatedAt: "2026-07-30T02:00:00.000Z"
      },
      adjustments: [{ id: "adj-1", label: "已调整强度", undoneAt: null }],
      appliedMemories: []
    };

    expect(finalizeAssistantMessage(messages, "local-assistant-1", final)).toEqual([
      {
        id: "local-assistant-1",
        role: "assistant",
        content: "建议恢复跑。",
        adjustments: final.adjustments
      }
    ]);
  });
});
