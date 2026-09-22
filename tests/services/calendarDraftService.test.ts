import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/src/db/client", () => ({
  prisma: {
    calendarEventDraft: { findMany: vi.fn(), updateMany: vi.fn() },
    user: { findUnique: vi.fn() }
  }
}));

vi.mock("@/src/services/feishuCalendarOAuthService", () => ({
  loadUserFeishuCalendarTokens: vi.fn(async () => null),
  writeCalendarDraftForUser: vi.fn(async () => ({ externalEventId: "feishu-event-1" }))
}));

import { prisma } from "@/src/db/client";
import { confirmCalendarDrafts } from "@/src/services/calendarDraftService";
import { loadUserFeishuCalendarTokens } from "@/src/services/feishuCalendarOAuthService";

const baseDraft = {
  id: "draft-1",
  userId: "user-1",
  status: "draft",
  operation: "upsert",
  title: "Easy run",
  startsAt: new Date("2026-07-20T00:00:00.000Z"),
  endsAt: new Date("2026-07-20T01:00:00.000Z"),
  notes: "Recovery pace",
  externalEventId: null
};

describe("calendar draft service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.HBM_LARK_CALENDAR_ACCOUNT_EMAIL = "owner@example.test";
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ email: "owner@example.test" } as never);
    vi.mocked(loadUserFeishuCalendarTokens).mockResolvedValue(null);
  });

  afterEach(() => {
    delete process.env.HBM_LARK_CALENDAR_ACCOUNT_EMAIL;
  });

  it("returns already confirmed drafts without writing them again", async () => {
    const confirmed = { ...baseDraft, status: "confirmed" };
    vi.mocked(prisma.calendarEventDraft.findMany).mockResolvedValueOnce([confirmed] as never).mockResolvedValueOnce([confirmed] as never);
    const writer = vi.fn();
    const drafts = await confirmCalendarDrafts("user-1", ["draft-1"], writer);
    expect(writer).not.toHaveBeenCalled();
    expect(prisma.calendarEventDraft.updateMany).not.toHaveBeenCalled();
    expect(drafts).toEqual([confirmed]);
  });

  it("rejects superseded drafts so stale pages cannot confirm them", async () => {
    vi.mocked(prisma.calendarEventDraft.findMany).mockResolvedValue([{ ...baseDraft, status: "superseded" }] as never);
    await expect(confirmCalendarDrafts("user-1", ["draft-1"], vi.fn())).rejects.toThrow("Draft is not actionable");
  });

  it("claims a draft before writing and stores the real external event id", async () => {
    const confirmed = { ...baseDraft, status: "confirmed", externalEventId: "feishu-event-1" };
    vi.mocked(prisma.calendarEventDraft.findMany).mockResolvedValueOnce([baseDraft] as never).mockResolvedValueOnce([confirmed] as never);
    vi.mocked(prisma.calendarEventDraft.updateMany).mockResolvedValue({ count: 1 });
    const writer = vi.fn().mockResolvedValue({ externalEventId: "feishu-event-1" });

    await confirmCalendarDrafts("user-1", ["draft-1"], writer);

    expect(writer).toHaveBeenCalledWith(baseDraft);
    expect(prisma.calendarEventDraft.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: "draft-1", userId: "user-1", status: { in: ["draft", "failed"] } },
      data: { status: "writing", failureReason: null }
    });
    expect(prisma.calendarEventDraft.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: "draft-1", userId: "user-1", status: "writing" },
      data: { status: "confirmed", externalEventId: "feishu-event-1", failureReason: null }
    });
  });

  it("clears the external event id after a real cancellation", async () => {
    const draft = { ...baseDraft, operation: "cancel", externalEventId: "feishu-event-1" };
    vi.mocked(prisma.calendarEventDraft.findMany).mockResolvedValueOnce([draft] as never).mockResolvedValueOnce([{ ...draft, status: "confirmed", externalEventId: null }] as never);
    vi.mocked(prisma.calendarEventDraft.updateMany).mockResolvedValue({ count: 1 });
    await confirmCalendarDrafts("user-1", ["draft-1"], vi.fn().mockResolvedValue({ externalEventId: null }));
    expect(prisma.calendarEventDraft.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: "draft-1", userId: "user-1", status: "writing" },
      data: { status: "confirmed", externalEventId: null, failureReason: null }
    });
  });

  it("records provider failures and leaves the draft retryable", async () => {
    const failed = { ...baseDraft, status: "failed", failureReason: "Missing calendar scope" };
    vi.mocked(prisma.calendarEventDraft.findMany).mockResolvedValueOnce([baseDraft] as never).mockResolvedValueOnce([failed] as never);
    vi.mocked(prisma.calendarEventDraft.updateMany).mockResolvedValue({ count: 1 });
    const result = await confirmCalendarDrafts("user-1", ["draft-1"], vi.fn().mockRejectedValue(new Error("Missing calendar scope")));
    expect(prisma.calendarEventDraft.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: "draft-1", userId: "user-1", status: "writing" },
      data: { status: "failed", failureReason: "Missing calendar scope" }
    });
    expect(result[0].status).toBe("failed");
  });

  it("rejects a draft that becomes unavailable before it can be claimed", async () => {
    vi.mocked(prisma.calendarEventDraft.findMany).mockResolvedValue([baseDraft] as never);
    vi.mocked(prisma.calendarEventDraft.updateMany).mockResolvedValue({ count: 0 });
    await expect(confirmCalendarDrafts("user-1", ["draft-1"], vi.fn())).rejects.toThrow("Draft is no longer actionable");
  });

  it("refuses to write for any account other than the one the deployment names", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ email: "someone-else@example.test" } as never);
    const writer = vi.fn();

    await expect(confirmCalendarDrafts("user-2", ["draft-1"], writer)).rejects.toThrow(
      "Calendar write-back is not available for this account"
    );
    expect(writer).not.toHaveBeenCalled();
    expect(prisma.calendarEventDraft.updateMany).not.toHaveBeenCalled();
  });

  it("stays disabled until a deployment names the account that owns the Feishu login", async () => {
    delete process.env.HBM_LARK_CALENDAR_ACCOUNT_EMAIL;
    const writer = vi.fn();

    await expect(confirmCalendarDrafts("user-1", ["draft-1"], writer)).rejects.toThrow(
      "HBM_LARK_CALENDAR_ACCOUNT_EMAIL"
    );
    expect(writer).not.toHaveBeenCalled();
  });

  it("allows any account that has completed Feishu calendar OAuth", async () => {
    delete process.env.HBM_LARK_CALENDAR_ACCOUNT_EMAIL;
    vi.mocked(loadUserFeishuCalendarTokens).mockResolvedValue({
      accessToken: "user-token",
      calendarId: "primary"
    });
    const confirmed = { ...baseDraft, status: "confirmed", externalEventId: "oauth-event-1" };
    vi.mocked(prisma.calendarEventDraft.findMany).mockResolvedValueOnce([baseDraft] as never).mockResolvedValueOnce([confirmed] as never);
    vi.mocked(prisma.calendarEventDraft.updateMany).mockResolvedValue({ count: 1 });
    const writer = vi.fn().mockResolvedValue({ externalEventId: "oauth-event-1" });

    await confirmCalendarDrafts("user-2", ["draft-1"], writer);

    expect(writer).toHaveBeenCalledWith(baseDraft);
  });
});
