import { describe, expect, it, vi } from "vitest";

vi.mock("@/src/auth/api", () => ({ withUser: (handler: (...args: never[]) => Promise<Response>) => () => handler({ id: "user-1" } as never) }));
const { listAutomationStates } = vi.hoisted(() => ({ listAutomationStates: vi.fn() }));
vi.mock("@/src/services/automationService", () => ({ listAutomationStates }));
import { GET } from "@/app/api/v1/automation/status/route";

describe("GET /api/v1/automation/status", () => {
  it("returns user-scoped automation state", async () => {
    listAutomationStates.mockResolvedValue([{ id: "state-1", kind: "calendar_sync", status: "success" }]);
    const response = await GET(new Request("http://localhost/api/v1/automation/status"));
    expect(listAutomationStates).toHaveBeenCalledWith("user-1");
    expect(await response.json()).toEqual([{ id: "state-1", kind: "calendar_sync", status: "success" }]);
  });
});
