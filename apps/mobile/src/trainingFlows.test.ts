import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("mobile training flows", () => {
  it("wires the Today tab to submit checklist completion", () => {
    const source = readFileSync(new URL("../app/(app)/(tabs)/today.tsx", import.meta.url), "utf8");

    expect(source).toContain("completeTrainingTask");
    expect(source).toContain("useMutation");
    expect(source).toContain("提交完成");
  });

  it("wires the Plan tab to generate or refresh the current week plan", () => {
    const source = readFileSync(new URL("../app/(app)/(tabs)/plan.tsx", import.meta.url), "utf8");

    expect(source).toContain("generateActivePlan");
    expect(source).toContain("currentWeekStartIso");
    expect(source).toContain("生成本周计划");
  });
});
