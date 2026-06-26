import { describe, expect, it } from "vitest";
import { guardAction } from "@/src/services/agentActions/safetyGuard";

const freeWindows = [{ start: "2026-06-24T10:00:00+08:00", end: "2026-06-24T12:00:00+08:00" }];

describe("agent action safety guard", () => {
  it("blocks intensity upgrade when recovery is poor and downgrades to easy", () => {
    const result = guardAction(
      { id: "adjust_task_intensity", args: { taskId: "t1", intensity: "moderate" } },
      { poorRecovery: true, poorSleep: false, injury: false, freeWindows, taskCurrentIntensity: "easy" }
    );

    expect(result.accepted).toBe(true);
    expect(result.args.intensity).toBe("easy");
    expect(result.fallbackReason).toBeTruthy();
  });

  it("allows intensity changes when signals are healthy", () => {
    const result = guardAction(
      { id: "adjust_task_intensity", args: { taskId: "t1", intensity: "moderate" } },
      { poorRecovery: false, poorSleep: false, injury: false, freeWindows, taskCurrentIntensity: "easy" }
    );
    expect(result.accepted).toBe(true);
    expect(result.args.intensity).toBe("moderate");
  });

  it("rejects reschedule outside free windows", () => {
    const result = guardAction(
      { id: "reschedule_task", args: { taskId: "t1", newStart: "2026-06-24T23:00:00+08:00" } },
      { poorRecovery: false, poorSleep: false, injury: false, freeWindows, taskCurrentIntensity: "easy" }
    );
    expect(result.accepted).toBe(false);
    expect(result.fallbackReason).toContain("free window");
  });

  it("allows reschedule inside a free window", () => {
    const result = guardAction(
      { id: "reschedule_task", args: { taskId: "t1", newStart: "2026-06-24T10:30:00+08:00" } },
      { poorRecovery: false, poorSleep: false, injury: false, freeWindows, taskCurrentIntensity: "easy" }
    );
    expect(result.accepted).toBe(true);
  });

  it("passes through non-guarded actions unchanged", () => {
    const result = guardAction(
      { id: "skip_task", args: { taskId: "t1", reason: "busy" } },
      { poorRecovery: false, poorSleep: false, injury: false, freeWindows, taskCurrentIntensity: "easy" }
    );
    expect(result.accepted).toBe(true);
    expect(result.args).toEqual({ taskId: "t1", reason: "busy" });
  });
});
