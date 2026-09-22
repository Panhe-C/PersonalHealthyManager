import { describe, expect, it } from "vitest";
import { createVisibleTextFilter } from "@/src/services/agentStreaming/visibleText";

describe("visible Agent text filter", () => {
  it("streams explanation while withholding split control tags", () => {
    const filter = createVisibleTextFilter();
    expect(filter.push("<expla")).toBe("");
    expect(filter.push("nation>建议恢复")).toBe("建议恢复");
    expect(filter.push("跑。</explan")).toBe("跑。");
    expect(filter.push('ation><actions>[{"id":"reschedule_task"}]</actions>')).toBe("");
    expect(filter.finish()).toBe("");
  });

  it("streams plain text without leaking a split memories tag", () => {
    const filter = createVisibleTextFilter();
    expect(filter.push("先休息。\n<memo")).toBe("先休息。\n");
    expect(filter.push('ries>[{"op":"add"}]</memories>')).toBe("");
    expect(filter.finish()).toBe("");
  });

  it("flushes ordinary tag-like text that is not a control marker", () => {
    const filter = createVisibleTextFilter();
    expect(filter.push("心率 < 150，")).toBe("心率 < 150，");
    expect(filter.push("保持轻松。")).toBe("保持轻松。");
    expect(filter.finish()).toBe("");
  });
});
