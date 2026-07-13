import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../app/(app)/(tabs)/coach.tsx", import.meta.url), "utf8");

describe("coach conversation lifecycle", () => {
  it("attempts automatic conversation creation only once and never after the list query fails", () => {
    expect(source).toContain("autoCreateAttemptedRef");
    expect(source).toContain("!conversationsQuery.error");
    expect(source).toContain("autoCreateAttemptedRef.current = true");
    expect(source).not.toContain("[conversations.length, conversationsQuery.isLoading, createConversationMutation]");
  });
});
