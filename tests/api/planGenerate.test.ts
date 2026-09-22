import { beforeEach, describe, expect, it, vi } from "vitest";
import { generatePlanForUser, PlanPreconditionError } from "@/src/services/planService";
import { POST } from "@/app/api/plan/generate/route";

vi.mock("@/src/auth/api", () => ({
  withUser:
    (handler: (...args: unknown[]) => Promise<Response>) =>
    (request: Request) =>
      handler({ id: "user-1", timezone: "Asia/Shanghai" }, request)
}));

vi.mock("@/src/services/planService", () => ({
  generatePlanForUser: vi.fn(),
  PlanPreconditionError: class extends Error {
    constructor(
      message: string,
      readonly code: string
    ) {
      super(message);
    }
  }
}));

const validWeekStart = "2026-07-26T16:00:00.000Z"; // Monday midnight Asia/Shanghai

function generateRequest(weekStart: string) {
  return new Request("http://localhost/api/plan/generate", {
    method: "POST",
    body: JSON.stringify({ weekStart })
  });
}

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

  it("reports a missing prerequisite as 409 with a message the client can show", async () => {
    vi.mocked(generatePlanForUser).mockRejectedValue(
      new PlanPreconditionError("生成计划前需要先填写身体资料。", "body_profile_missing")
    );

    const response = await POST(generateRequest(validWeekStart));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "生成计划前需要先填写身体资料。",
      code: "body_profile_missing"
    });
  });

  it("lets unexpected failures surface instead of disguising them as a prerequisite", async () => {
    vi.mocked(generatePlanForUser).mockRejectedValue(new Error("database is on fire"));

    await expect(POST(generateRequest(validWeekStart))).rejects.toThrow("database is on fire");
  });
});
