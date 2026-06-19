import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/sync/coros/route";
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

describe("COROS sync API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("syncs COROS from Settings when the request body is empty", async () => {
    vi.mocked(syncCorosFromSettings).mockResolvedValue({ activities: 1, sleep: 1, recovery: 1 });

    const response = await POST(new Request("http://localhost/api/sync/coros", { method: "POST", body: "{}" }));

    expect(syncCorosFromSettings).toHaveBeenCalledWith("user-1");
    expect(importCorosPayload).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({ activities: 1, sleep: 1, recovery: 1 });
  });

  it("keeps explicit COROS payload imports for development fixtures", async () => {
    const payload = { activities: [{ labelId: "fixture-run" }] };
    vi.mocked(importCorosPayload).mockResolvedValue({ activities: 1, sleep: 0, recovery: 0 });

    const response = await POST(new Request("http://localhost/api/sync/coros", { method: "POST", body: JSON.stringify(payload) }));

    expect(importCorosPayload).toHaveBeenCalledWith("user-1", payload);
    expect(syncCorosFromSettings).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({ activities: 1, sleep: 0, recovery: 0 });
  });

  it("returns a 400 response when the configured COROS sync cannot run", async () => {
    vi.mocked(syncCorosFromSettings).mockRejectedValue(new Error("COROS MCP endpoint is not configured."));

    const response = await POST(new Request("http://localhost/api/sync/coros", { method: "POST", body: "{}" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "COROS MCP endpoint is not configured." });
  });
});
