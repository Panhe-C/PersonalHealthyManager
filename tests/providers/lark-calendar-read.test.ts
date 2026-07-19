import { describe, expect, it, vi } from "vitest";
import { fetchLarkCalendarPayload } from "@/src/providers/lark-calendar-read";

describe("Lark calendar read provider", () => {
  it("converts agenda events into busy and usable free training windows", async () => {
    const runner = vi.fn().mockResolvedValue(JSON.stringify({
      ok: true,
      data: [{
        summary: "Work meeting",
        free_busy_status: "busy",
        start_time: { datetime: "2026-07-19T09:00:00+08:00" },
        end_time: { datetime: "2026-07-19T10:00:00+08:00" }
      }]
    }));

    const payload = await fetchLarkCalendarPayload(new Date("2026-07-18T16:00:00.000Z"), 1, runner);

    expect(runner).toHaveBeenCalledWith(["calendar", "+agenda", "--start", "2026-07-19", "--end", "2026-07-20", "--as", "user", "--format", "json"]);
    expect(payload.busy).toEqual([{ start: "2026-07-19T09:00:00+08:00", end: "2026-07-19T10:00:00+08:00", title: "Work meeting" }]);
    expect(payload.free).toEqual([
      { start: "2026-07-18T22:00:00.000Z", end: "2026-07-19T01:00:00.000Z" },
      { start: "2026-07-19T02:00:00.000Z", end: "2026-07-19T14:00:00.000Z" }
    ]);
  });

  it("rejects malformed command output", async () => {
    await expect(fetchLarkCalendarPayload(new Date(), 1, vi.fn().mockResolvedValue(JSON.stringify({ ok: false })))).rejects.toThrow("invalid");
  });
});
