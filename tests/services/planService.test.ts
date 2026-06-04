import { describe, expect, it, vi } from "vitest";
import { supersedePreviousPlansAndReadExternalEvents } from "@/src/services/planService";

describe("plan service replanning helpers", () => {
  it("supersedes old drafts before reading their external event ids", async () => {
    const calls: string[] = [];
    const tx = {
      calendarEventDraft: {
        updateMany: vi.fn(async () => {
          calls.push("supersede");
          return { count: 1 };
        }),
        findMany: vi.fn(async () => {
          calls.push("read");
          return [];
        })
      },
      plan: {
        updateMany: vi.fn(async () => ({ count: 1 }))
      }
    };

    await supersedePreviousPlansAndReadExternalEvents(tx as never, "user-1", ["plan-1"]);

    expect(calls).toEqual(["supersede", "read"]);
  });
});
