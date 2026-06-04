import { beforeEach, describe, expect, it, vi } from "vitest";
import { generatePlanForUser } from "@/src/services/planService";
import { POST } from "@/app/api/plan/generate/route";

vi.mock("@/src/auth/api", () => ({
  withUser:
    (handler: (...args: unknown[]) => Promise<Response>) =>
    (request: Request) =>
      handler({ id: "user-1", timezone: "Asia/Shanghai" }, request)
}));

vi.mock("@/src/services/planService", () => ({
  generatePlanForUser: vi.fn()
}));

describe("plan generation API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for an invalid week start", async () => {
    const response = await POST(
      new Request("http://localhost/api/plan/generate", {
        method: "POST",
        body: JSON.stringify({ weekStart: "not-a-date" })
      })
    );

    expect(response.status).toBe(400);
    expect(generatePlanForUser).not.toHaveBeenCalled();
  });

  it("returns 400 when the date is not Monday midnight in the user timezone", async () => {
    const response = await POST(
      new Request("http://localhost/api/plan/generate", {
        method: "POST",
        body: JSON.stringify({ weekStart: "2026-06-01T16:00:00.000Z" })
      })
    );

    expect(response.status).toBe(400);
    expect(generatePlanForUser).not.toHaveBeenCalled();
  });
});
