import { describe, expect, it, vi } from "vitest";
import { parseLarkCalendarResult, writeCalendarDraft } from "@/src/providers/calendar-writeback";

const draft = {
  id: "draft-1",
  title: "Easy run",
  startsAt: new Date("2026-07-20T00:00:00.000Z"),
  endsAt: new Date("2026-07-20T01:00:00.000Z"),
  notes: "Recovery pace",
  operation: "upsert",
  externalEventId: null
};

describe("Feishu calendar write-back", () => {
  it("extracts an event id from the CLI success envelope", () => {
    expect(parseLarkCalendarResult(JSON.stringify({ ok: true, data: { event: { event_id: "evt-1" } } }))).toBe("evt-1");
  });

  it("creates a calendar event with exact ISO times", async () => {
    const runner = vi.fn().mockResolvedValue(JSON.stringify({ ok: true, data: { event: { event_id: "evt-1" } } }));
    await expect(writeCalendarDraft(draft, runner)).resolves.toEqual({ externalEventId: "evt-1" });
    expect(runner).toHaveBeenCalledWith(expect.arrayContaining([
      "calendar", "+create", "--summary", "Easy run", "--start", "2026-07-20T00:00:00.000Z", "--end", "2026-07-20T01:00:00.000Z", "--as", "user"
    ]));
  });

  it("updates an existing event without changing its id", async () => {
    const runner = vi.fn().mockResolvedValue(JSON.stringify({ ok: true, data: {} }));
    await expect(writeCalendarDraft({ ...draft, externalEventId: "evt-1" }, runner)).resolves.toEqual({ externalEventId: "evt-1" });
    expect(runner).toHaveBeenCalledWith(expect.arrayContaining(["calendar", "+update", "--event-id", "evt-1"]));
  });

  it("deletes a cancellation target and clears its id", async () => {
    const runner = vi.fn().mockResolvedValue(JSON.stringify({ ok: true, data: {} }));
    await expect(writeCalendarDraft({ ...draft, operation: "cancel", externalEventId: "evt-1" }, runner)).resolves.toEqual({ externalEventId: null });
    expect(runner).toHaveBeenCalledWith(expect.arrayContaining(["calendar", "events", "delete", "--as", "user"]));
    expect(runner.mock.calls[0][0]).toContain(JSON.stringify({ calendar_id: "primary", event_id: "evt-1", need_notification: "true" }));
  });
});
