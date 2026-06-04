import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/src/db/client";
import { confirmCalendarDrafts } from "@/src/services/calendarDraftService";

vi.mock("@/src/db/client", () => ({
  prisma: {
    calendarEventDraft: {
      findMany: vi.fn(),
      updateMany: vi.fn()
    },
    $transaction: vi.fn()
  }
}));

describe("calendar draft service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => callback(prisma as never));
  });

  it("returns already confirmed drafts without writing them again", async () => {
    const confirmedDraft = {
      id: "draft-1",
      userId: "user-1",
      status: "confirmed"
    };
    vi.mocked(prisma.calendarEventDraft.findMany).mockResolvedValue([confirmedDraft] as never);

    const drafts = await confirmCalendarDrafts("user-1", ["draft-1"]);

    expect(prisma.calendarEventDraft.updateMany).not.toHaveBeenCalled();
    expect(drafts).toEqual([confirmedDraft]);
  });

  it("rejects superseded drafts so stale pages cannot confirm them", async () => {
    vi.mocked(prisma.calendarEventDraft.findMany).mockResolvedValue([
      {
        id: "draft-1",
        userId: "user-1",
        status: "superseded"
      }
    ] as never);

    await expect(confirmCalendarDrafts("user-1", ["draft-1"])).rejects.toThrow("Draft is not actionable");

    expect(prisma.calendarEventDraft.updateMany).not.toHaveBeenCalled();
  });

  it("retains an existing external event id when confirming an update draft", async () => {
    const draft = {
      id: "draft-1",
      userId: "user-1",
      status: "draft",
      externalEventId: "feishu-event-1"
    };
    vi.mocked(prisma.calendarEventDraft.findMany)
      .mockResolvedValueOnce([draft] as never)
      .mockResolvedValueOnce([{ ...draft, status: "confirmed" }] as never);
    vi.mocked(prisma.calendarEventDraft.updateMany).mockResolvedValue({ count: 1 });

    await confirmCalendarDrafts("user-1", ["draft-1"]);

    expect(prisma.calendarEventDraft.updateMany).toHaveBeenCalledWith({
      where: {
        id: "draft-1",
        userId: "user-1",
        status: { in: ["draft", "failed"] }
      },
      data: {
        status: "confirmed",
        externalEventId: "feishu-event-1",
        failureReason: null
      }
    });
  });

  it("clears the external event id when confirming a cancellation draft", async () => {
    const draft = {
      id: "draft-1",
      userId: "user-1",
      status: "draft",
      operation: "cancel",
      externalEventId: "feishu-event-1"
    };
    vi.mocked(prisma.calendarEventDraft.findMany)
      .mockResolvedValueOnce([draft] as never)
      .mockResolvedValueOnce([{ ...draft, status: "confirmed", externalEventId: null }] as never);
    vi.mocked(prisma.calendarEventDraft.updateMany).mockResolvedValue({ count: 1 });

    await confirmCalendarDrafts("user-1", ["draft-1"]);

    expect(prisma.calendarEventDraft.updateMany).toHaveBeenCalledWith({
      where: {
        id: "draft-1",
        userId: "user-1",
        status: { in: ["draft", "failed"] }
      },
      data: {
        status: "confirmed",
        externalEventId: null,
        failureReason: null
      }
    });
  });

  it("rejects a draft that becomes superseded before the conditional write", async () => {
    vi.mocked(prisma.calendarEventDraft.findMany).mockResolvedValue([
      {
        id: "draft-1",
        userId: "user-1",
        status: "draft",
        externalEventId: null
      }
    ] as never);
    vi.mocked(prisma.calendarEventDraft.updateMany).mockResolvedValue({ count: 0 });

    await expect(confirmCalendarDrafts("user-1", ["draft-1"])).rejects.toThrow("Draft is no longer actionable");
  });
});
