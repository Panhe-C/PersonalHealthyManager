import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/v1/sync/coros/route";
import { importCorosPayload, syncCorosFromSettings } from "@/src/services/syncService";

vi.mock("@/src/auth/api", () => ({
  withUser:
    (handler: (...args: unknown[]) => Promise<Response>) =>
    (request: Request) =>
      handler({ id: "user-1", timezone: "Asia/Shanghai" }, request)
}));

vi.mock("@/src/services/syncService", () => ({
  importCorosPayload: vi.fn(),
  syncCorosFromSettings: vi.fn()
}));

describe("mobile COROS sync API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts a two-day lookback for Today pull-to-refresh", async () => {
    vi.mocked(syncCorosFromSettings).mockResolvedValue({ activities: 1, sleep: 1, recovery: 0 });

    const response = await POST(
      new Request("http://localhost/api/v1/sync/coros", {
        method: "POST",
        body: JSON.stringify({ days: 2 })
      })
    );

    expect(syncCorosFromSettings).toHaveBeenCalledWith("user-1", { days: 2 });
    expect(importCorosPayload).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({ activities: 1, sleep: 1, recovery: 0 });
  });
});
