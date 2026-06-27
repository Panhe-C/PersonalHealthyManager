import { describe, expect, it } from "vitest";
import { parseMemoryProposals, stripMemoryBlock } from "@/src/services/agentMemory/memories";

describe("memory proposal parsing", () => {
  it("extracts memory proposals from a <memories> block", () => {
    const reply = [
      "<explanation>好的，我记住了</explanation>",
      "<memories>",
      '[{"op":"add","kind":"preference","category":"training","content":"习惯晨跑","confidence":0.9}]',
      "</memories>"
    ].join("\n");

    const result = parseMemoryProposals(reply);

    expect(result.memories).toEqual([
      { op: "add", kind: "preference", category: "training", content: "习惯晨跑", confidence: 0.9, targetContent: undefined }
    ]);
    expect(result.warnings).toEqual([]);
  });

  it("treats replies without a memories block as empty", () => {
    const result = parseMemoryProposals("这是一段纯文字解释。");
    expect(result.memories).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("drops entries with invalid op, kind, category, or missing content with warnings", () => {
    const reply = [
      "<memories>",
      '[{"op":"wipe","kind":"preference","category":"training","content":"x","confidence":0.9},',
      '{"op":"add","kind":"bogus","category":"training","content":"x","confidence":0.9},',
      '{"op":"add","kind":"preference","category":"bogus","content":"x","confidence":0.9},',
      '{"op":"add","kind":"preference","category":"training","content":"  ","confidence":0.9}]',
      "</memories>"
    ].join("\n");

    const result = parseMemoryProposals(reply);

    expect(result.memories).toEqual([]);
    expect(result.warnings.length).toBe(4);
  });

  it("recovers gracefully from malformed JSON in the memories block", () => {
    const result = parseMemoryProposals("<memories>\n[not json}\n</memories>");
    expect(result.memories).toEqual([]);
    expect(result.warnings.length).toBe(1);
  });

  it("does not misread a fenced action block as memories", () => {
    const reply = [
      "好的",
      "```json",
      '[{"id":"adjust_task_intensity","args":{"taskId":"t1","intensity":"easy"}}]',
      "```"
    ].join("\n");

    const result = parseMemoryProposals(reply);
    expect(result.memories).toEqual([]);
  });

  it("recognizes a fenced memories block when the model omits <memories> tags", () => {
    const reply = [
      "好的，记下了",
      "```json",
      '[{"op":"add","kind":"fact","category":"nutrition","content":"对麸质过敏","confidence":0.8}]',
      "```"
    ].join("\n");

    const result = parseMemoryProposals(reply);
    expect(result.memories).toHaveLength(1);
    expect(result.memories[0].content).toBe("对麸质过敏");
  });

  it("stripMemoryBlock removes the <memories> block from user-facing text", () => {
    const reply = [
      "好的，我记住了。",
      "<memories>",
      '[{"op":"add","kind":"preference","category":"training","content":"习惯晨跑","confidence":0.9}]',
      "</memories>"
    ].join("\n");

    expect(stripMemoryBlock(reply)).toBe("好的，我记住了。");
  });
});
