/* eslint-disable import/first -- component imports must follow Vitest module mocks */
import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  StyleSheet: { create: (styles: unknown) => styles },
  useColorScheme: () => "light",
  View: "View"
}));

vi.mock("./Text", () => ({ Text: "Text" }));

import { buildHeatmapWeeks } from "../insights/aggregates";
import { ActivityHeatmap } from "./ActivityHeatmap";

type Node = {
  type?: unknown;
  props?: {
    testID?: string;
    style?: unknown;
    children?: unknown;
  };
};

function collect(node: unknown, predicate: (element: Node) => boolean): Node[] {
  if (Array.isArray(node)) return node.flatMap((child) => collect(child, predicate));
  if (!node || typeof node !== "object") return [];
  const element = node as Node;
  const self = predicate(element) ? [element] : [];
  return [...self, ...collect(element.props?.children, predicate)];
}

function flatten(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) return Object.assign({}, ...style.map(flatten));
  return (style ?? {}) as Record<string, unknown>;
}

// 2026-07-29 is a Wednesday; the grid's last column is 2026-07-27 → 2026-08-02.
const TODAY = new Date("2026-07-29T08:00:00+08:00");
const TODAY_KEY = "2026-07-29";

function renderHeatmap(minutesByDay: Map<string, number>) {
  return ActivityHeatmap({
    weeks: buildHeatmapWeeks(TODAY, 12, "Asia/Shanghai"),
    minutesByDay,
    todayKey: TODAY_KEY
  });
}

function cells(tree: unknown): Record<string, unknown>[] {
  return collect(tree, (element) => element.props?.testID === "heatmap-cell").map((cell) =>
    flatten(cell.props?.style)
  );
}

describe("ActivityHeatmap", () => {
  it("renders 84 cells for the 12 weeks", () => {
    expect(cells(renderHeatmap(new Map()))).toHaveLength(84);
  });

  it("colours cells by the fixed intensity scale", () => {
    const minutes = new Map([
      ["2026-07-27", 20], // scale 1 → 25%
      ["2026-07-28", 45], // scale 2 → 50%
      ["2026-07-29", 95] // scale 4 → 100% (today is not the future)
    ]);
    const styles = cells(renderHeatmap(minutes));

    const monday = styles[77]; // last column starts at index 11 * 7
    expect(monday.backgroundColor).toBe("#4C9A6B");
    expect(monday.opacity).toBe(0.25);
    expect(styles[78].opacity).toBe(0.5);
    expect(styles[79].opacity).toBe(1);
  });

  it("renders rest days in fill at full opacity", () => {
    const styles = cells(renderHeatmap(new Map()));

    expect(styles[0].backgroundColor).toBe("#E3E1D9"); // 2026-05-11, no record
    expect(styles[0].opacity).toBe(1);
  });

  it("renders future days of the current week as background, not zero", () => {
    const styles = cells(renderHeatmap(new Map()));

    for (const index of [80, 81, 82, 83]) {
      expect(styles[index].backgroundColor).toBeUndefined();
    }
  });

  it("renders the 少 → 多 legend with the five scale swatches", () => {
    const tree = renderHeatmap(new Map());

    const swatches = collect(tree, (element) => element.props?.testID === "heatmap-swatch").map((swatch) =>
      flatten(swatch.props?.style)
    );
    expect(swatches).toHaveLength(5);
    expect(swatches[0].backgroundColor).toBe("#E3E1D9");
    expect(swatches.map((swatch) => swatch.opacity)).toEqual([1, 0.25, 0.5, 0.75, 1]);

    const labels = collect(tree, (element) => element.type === "Text").map((text) => text.props?.children);
    expect(labels).toEqual(["少", "多"]);
  });
});
