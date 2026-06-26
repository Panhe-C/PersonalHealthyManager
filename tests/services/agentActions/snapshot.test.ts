import { describe, expect, it } from "vitest";
import {
  serializeSnapshot,
  restoreStatementsFromSnapshot
} from "@/src/services/agentActions/snapshot";

describe("agent action snapshot", () => {
  it("serializes touched tasks and drafts into a flat snapshot with ISO dates", () => {
    const snapshot = serializeSnapshot({
      tasks: [
        {
          id: "t1",
          intensity: "moderate",
          durationMinutes: 60,
          title: "Run",
          date: new Date("2026-06-24T00:00:00+08:00"),
          scheduledStart: new Date("2026-06-24T10:00:00+08:00"),
          scheduledEnd: new Date("2026-06-24T11:00:00+08:00"),
          status: "planned"
        }
      ],
      drafts: []
    });

    expect(snapshot.tasks[0]).toMatchObject({ id: "t1", intensity: "moderate", durationMinutes: 60, status: "planned" });
    expect(typeof snapshot.tasks[0].date).toBe("string");
    expect(snapshot.tasks[0].scheduledStart).toBe("2026-06-24T02:00:00.000Z");
    expect(snapshot.drafts).toEqual([]);
  });

  it("serializes drafts with ISO timestamps", () => {
    const snapshot = serializeSnapshot({
      tasks: [],
      drafts: [
        {
          id: "d1",
          title: "Training: Run",
          startsAt: new Date("2026-06-24T10:00:00+08:00"),
          endsAt: new Date("2026-06-24T11:00:00+08:00"),
          notes: "Type: run.",
          status: "draft",
          failureReason: null
        }
      ]
    });

    expect(snapshot.drafts[0]).toMatchObject({ id: "d1", title: "Training: Run", status: "draft" });
    expect(snapshot.drafts[0].startsAt).toBe("2026-06-24T02:00:00.000Z");
  });

  it("builds per-row restore update payloads with Date objects", () => {
    const statements = restoreStatementsFromSnapshot({
      tasks: [
        {
          id: "t1",
          intensity: "easy",
          durationMinutes: 40,
          title: "Easy run",
          date: "2026-06-24T00:00:00.000Z",
          scheduledStart: null,
          scheduledEnd: null,
          status: "planned"
        }
      ],
      drafts: [
        {
          id: "d1",
          title: "Training: Easy run",
          startsAt: null,
          endsAt: null,
          notes: "n",
          status: "draft",
          failureReason: null
        }
      ]
    });

    expect(statements.tasks[0]).toMatchObject({
      id: "t1",
      data: { intensity: "easy", durationMinutes: 40, title: "Easy run", status: "planned" }
    });
    expect(statements.tasks[0].data.date).toBeInstanceOf(Date);
    expect(statements.tasks[0].data.scheduledStart).toBeNull();
    expect(statements.drafts[0]).toMatchObject({ id: "d1", data: { status: "draft", notes: "n" } });
  });
});
