import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/src/db/client";
import { confirmCalendarDrafts } from "@/src/services/calendarDraftService";

vi.mock("@/src/db/client", () => ({
  prisma: {
    calendarEventDraft: {
      findMany: vi.fn(),
      update: vi.fn()
    },
    $transaction: vi.fn()
  }
}));

describe("calendar draft service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns already confirmed drafts without opening an empty transaction", async () => {
    const confirmedDraft = {
      id: "draft-1",
      userId: "user-1",
      status: "confirmed"
    };
    vi.mocked(prisma.calendarEventDraft.findMany).mockResolvedValue([confirmedDraft] as never);

    const drafts = await confirmCalendarDrafts("user-1", ["draft-1"]);

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(drafts).toEqual([confirmedDraft]);
  });
});
