import { describe, expect, it } from "vitest";
import { parseInline, parseRichMessage } from "./richMessage";

describe("parseRichMessage", () => {
  it("keeps a data table as a table instead of flattening it to text", () => {
    const blocks = parseRichMessage(
      ["| 日期 | 睡眠时长 | 评分 |", "| --- | --- | --- |", "| 2026-07-24 | 507 | 93 |", "| 2026-07-25 | 531 | 67 |"].join("\n")
    );

    expect(blocks).toEqual([
      {
        kind: "table",
        headers: ["日期", "睡眠时长", "评分"],
        rows: [
          ["2026-07-24", "507", "93"],
          ["2026-07-25", "531", "67"]
        ]
      }
    ]);
  });

  it("pads short rows so every row lines up with the header", () => {
    const blocks = parseRichMessage(["| 日期 | 评分 | 备注 |", "| --- | --- | --- |", "| 2026-07-24 | 93 |"].join("\n"));

    expect(blocks).toEqual([{ kind: "table", headers: ["日期", "评分", "备注"], rows: [["2026-07-24", "93", ""]] }]);
  });

  it("degrades a header-only table to a paragraph rather than drawing an empty grid", () => {
    const blocks = parseRichMessage(["| 日期 | 评分 |", "| --- | --- |"].join("\n"));

    expect(blocks).toEqual([{ kind: "paragraph", text: "日期 · 评分" }]);
  });

  it("separates headings, paragraphs and bullet lists", () => {
    const blocks = parseRichMessage(
      ["## 睡眠趋势", "整体状况良好。", "", "- 7月24日评分很高", "- 26-28 日在中等水平", "", "### 训练负荷"].join("\n")
    );

    expect(blocks).toEqual([
      { kind: "heading", level: 1, text: "睡眠趋势" },
      { kind: "paragraph", text: "整体状况良好。" },
      { kind: "list", ordered: false, items: ["7月24日评分很高", "26-28 日在中等水平"] },
      { kind: "heading", level: 2, text: "训练负荷" }
    ]);
  });

  it("recognises ordered lists separately from bullets", () => {
    const blocks = parseRichMessage(["1. 先做热身", "2. 再跑间歇"].join("\n"));

    expect(blocks).toEqual([{ kind: "list", ordered: true, items: ["先做热身", "再跑间歇"] }]);
  });

  it("keeps fenced code verbatim", () => {
    const blocks = parseRichMessage(["```", "line one", "  line two", "```"].join("\n"));

    expect(blocks).toEqual([{ kind: "code", text: "line one\n  line two" }]);
  });

  it("splits a heading the model ran onto the previous line", () => {
    const blocks = parseRichMessage("整体状况良好。 ## 训练负荷");

    expect(blocks).toEqual([
      { kind: "paragraph", text: "整体状况良好。" },
      { kind: "heading", level: 1, text: "训练负荷" }
    ]);
  });

  it("joins wrapped paragraph lines and breaks on a blank line", () => {
    const blocks = parseRichMessage(["第一段前半", "第一段后半", "", "第二段"].join("\n"));

    expect(blocks).toEqual([
      { kind: "paragraph", text: "第一段前半 第一段后半" },
      { kind: "paragraph", text: "第二段" }
    ]);
  });

  it("reads a horizontal rule as a divider", () => {
    expect(parseRichMessage("---")).toEqual([{ kind: "divider" }]);
  });
});

describe("parseInline", () => {
  it("marks bold and code runs while keeping the surrounding text", () => {
    expect(parseInline("恢复分数 **98%**，用 `coros sync` 刷新")).toEqual([
      { text: "恢复分数 " },
      { text: "98%", bold: true },
      { text: "，用 " },
      { text: "coros sync", code: true },
      { text: " 刷新" }
    ]);
  });

  it("returns a single span when there is nothing to mark", () => {
    expect(parseInline("普通文本")).toEqual([{ text: "普通文本" }]);
  });
});
