import { describe, expect, it } from "vitest";
import { parseActionProposals } from "@/src/services/agentActions/proposals";

describe("action proposal parsing", () => {
  it("extracts explanation and valid actions from an <actions> block", () => {
    const reply = [
      "<explanation>已为你把周三降为 easy</explanation>",
      "<actions>",
      '[{"id":"adjust_task_intensity","args":{"taskId":"t1","intensity":"easy"}}]',
      "</actions>"
    ].join("\n");

    const result = parseActionProposals(reply);

    expect(result.explanation).toBe("已为你把周三降为 easy");
    expect(result.actions).toEqual([
      { id: "adjust_task_intensity", args: { taskId: "t1", intensity: "easy" } }
    ]);
    expect(result.warnings).toEqual([]);
  });

  it("treats replies without an actions block as explanation-only", () => {
    const result = parseActionProposals("这是一段纯文字解释。");
    expect(result.actions).toEqual([]);
    expect(result.explanation).toBe("这是一段纯文字解释。");
  });

  it("drops unknown action ids and schema-invalid args with a warning", () => {
    const reply = [
      "<actions>",
      '[{"id":"delete_everything","args":{}},{"id":"adjust_task_intensity","args":{"taskId":"t1","intensity":"nuclear"}}]',
      "</actions>"
    ].join("\n");

    const result = parseActionProposals(reply);

    expect(result.actions).toEqual([]);
    expect(result.warnings.length).toBe(2);
  });

  it("recovers gracefully from malformed JSON in the actions block", () => {
    const result = parseActionProposals("<actions>\n[not json}\n</actions>");
    expect(result.actions).toEqual([]);
    expect(result.warnings.length).toBe(1);
  });

  it("recognizes a ```json fenced action block when the model omits <actions> tags", () => {
    const reply = [
      "已为你把周三降为 easy",
      "```json",
      '[{"id":"adjust_task_intensity","args":{"taskId":"t1","intensity":"easy"}}]',
      "```"
    ].join("\n");

    const result = parseActionProposals(reply);

    expect(result.actions).toEqual([
      { id: "adjust_task_intensity", args: { taskId: "t1", intensity: "easy" } }
    ]);
    expect(result.explanation).toBe("已为你把周三降为 easy");
    expect(result.explanation).not.toContain("```");
  });

  it("strips a fenced action block from the explanation even when no actions parse", () => {
    const reply = ["好的，以下是建议。", "```json", '[{"id":"bogus","args":{}}]', "```"].join("\n");

    const result = parseActionProposals(reply);

    expect(result.actions).toEqual([]);
    expect(result.explanation).toBe("好的，以下是建议。");
    expect(result.explanation).not.toContain("```");
  });

  it("strips an unclosed ```json fence so raw backticks never reach the user", () => {
    const reply = ["好的，以下是建议。", "```json", '[{"id":"bogus","args":{}}]'].join("\n");

    const result = parseActionProposals(reply);

    expect(result.actions).toEqual([]);
    expect(result.explanation).toBe("好的，以下是建议。");
    expect(result.explanation).not.toContain("```");
  });
});
