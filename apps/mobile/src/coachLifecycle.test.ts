import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../app/(app)/(tabs)/coach/index.tsx", import.meta.url), "utf8");

describe("coach conversation lifecycle", () => {
  it("attempts automatic conversation creation only once and never after the list query fails", () => {
    expect(source).toContain("autoCreateAttemptedRef");
    expect(source).toContain("!conversationsQuery.error");
    expect(source).toContain("autoCreateAttemptedRef.current = true");
    expect(source).not.toContain("[conversations.length, conversationsQuery.isLoading, createConversationMutation]");
  });

  it("streams assistant deltas into one optimistic message and reconciles the final event", () => {
    expect(source).toContain("streamAgentMessage");
    expect(source).toContain("appendAssistantDelta(items, assistantMessageId, event.text)");
    expect(source).toContain("finalizeAssistantMessage(items, assistantMessageId, event)");
    expect(source).toContain("回复中断，请重试。");
    expect(source).toContain("activeSendRef.current?.controller !== controller");
    expect(source).toContain("disabled={sending}");
    expect(source).not.toContain("sendMutation");
    expect(source).not.toContain("sendAgentMessage");
  });

  it("auto-sends analysis prompts passed from Insights Ask AI", () => {
    expect(source).toContain("useLocalSearchParams");
    expect(source).toContain("consumedAskIdRef");
    expect(source).toContain("incomingPrompt");
    expect(source).toContain('router.setParams({ prompt: undefined, askId: undefined })');
    expect(source).toContain("void submitMessage(prompt)");
  });
});
