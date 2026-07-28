import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/src/db/client";
import { findCalendarSnapshotForWeek } from "@/src/services/planQueryService";

vi.mock("@/src/db/client", () => ({
  prisma: {
    calendarSnapshot: { findFirst: vi.fn() }
  }
}));

const weekStart = new Date("2026-07-26T16:00:00.000Z"); // Monday midnight Asia/Shanghai
const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);

/** Replays the emitted where clause against a candidate snapshot range. */
async function snapshotFilter() {
  await findCalendarSnapshotForWeek("user-1", weekStart, weekEnd);
  const clause = vi.mocked(prisma.calendarSnapshot.findFirst).mock.calls[0][0]?.where as {
    rangeStart: { lte: Date };
    rangeEnd: { gte: Date };
  };

  return (rangeStart: string, rangeEnd: string) =>
    new Date(rangeStart) <= clause.rangeStart.lte && new Date(rangeEnd) >= clause.rangeEnd.gte;
}

describe("calendar snapshot lookup for a plan week", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.calendarSnapshot.findFirst).mockResolvedValue(null);
  });

  it("takes the most recent snapshot", async () => {
    await findCalendarSnapshotForWeek("user-1", weekStart, weekEnd);

    expect(prisma.calendarSnapshot.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { capturedAt: "desc" } })
    );
  });

  it("accepts the mid-week snapshot that a containment check would reject", async () => {
    const matches = await snapshotFilter();

    // The Feishu sync captures from 06:00 on the day it runs, so a Tuesday sync
    // starts after the week's Monday midnight but still covers the days left.
    expect(matches("2026-07-27T22:00:00.000Z", "2026-08-05T14:00:00.000Z")).toBe(true);
  });

  it("still rejects snapshots that miss the week entirely", async () => {
    const matches = await snapshotFilter();

    expect(matches("2026-07-13T22:00:00.000Z", "2026-07-21T14:00:00.000Z")).toBe(false);
    expect(matches("2026-08-10T22:00:00.000Z", "2026-08-18T14:00:00.000Z")).toBe(false);
  });
});
