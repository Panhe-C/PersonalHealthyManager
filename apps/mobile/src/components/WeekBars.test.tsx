/* eslint-disable import/first -- component imports must follow Vitest module mocks */
import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  StyleSheet: { create: (styles: unknown) => styles },
  useColorScheme: () => "light",
  View: "View"
}));

vi.mock("./Text", () => ({ Text: "Text" }));

import { WeekBars, type WeekBar } from "./WeekBars";

type Node = {
  type?: unknown;
  props?: {
    accessible?: boolean;
    accessibilityLabel?: string;
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

const dayNames = ["一", "二", "三", "四", "五", "六", "日"];

function bars(): WeekBar[] {
  const values = [45, 0, 30, 90, 0, 0, 60];
  const tones = ["fill", "tintFill", "orange", "red", "fill", "fill", "controlFill"] as const;
  return dayNames.map((name, index) => ({
    key: `2026-07-${27 + index}`,
    label: name,
    value: values[index],
    tone: tones[index],
    accessibilityLabel: `周${name}测试`
  }));
}

function columns(tree: unknown): Node[] {
  return collect(tree, (element) => element.props?.accessible === true);
}

function barStyle(column: Node): Record<string, unknown> {
  const [bar] = collect(column.props?.children, (element) => element.type === "View");
  return flatten(bar.props?.style);
}

describe("WeekBars", () => {
  it("renders one accessible column per bar with its a11y label", () => {
    const cols = columns(WeekBars({ bars: bars() }));

    expect(cols).toHaveLength(7);
    expect(cols.map((col) => col.props?.accessibilityLabel)).toEqual([
      "周一测试",
      "周二测试",
      "周三测试",
      "周四测试",
      "周五测试",
      "周六测试",
      "周日测试"
    ]);
  });

  it("maps each tone to its theme colour", () => {
    const colours = columns(WeekBars({ bars: bars() })).map((col) => barStyle(col).backgroundColor);

    expect(colours).toEqual([
      "#E3E1D9", // fill
      "#4C9A6B", // tintFill
      "#E8823A", // orange
      "#C4534A", // red
      "#E3E1D9",
      "#E3E1D9",
      "#22221F" // controlFill
    ]);
  });

  it("scales heights against the week's maximum with a minimum placeholder", () => {
    const heights = columns(WeekBars({ bars: bars() })).map((col) => barStyle(col).height);

    expect(heights[3]).toBe(72); // 90 minutes is the week's maximum
    expect(heights[1]).toBe(6); // empty day placeholder
    expect(heights[0]).toBe(36); // 45/90 of 72
  });

  it("renders the weekday labels under the bars", () => {
    const labels = collect(WeekBars({ bars: bars() }), (element) => element.type === "Text").map(
      (text) => text.props?.children
    );

    expect(labels).toEqual(dayNames);
  });

  it("shows figures above the bars only when a bar carries a valueLabel", () => {
    const withValues = bars().map((bar, index) => ({ ...bar, valueLabel: index === 0 ? "45%" : undefined }));
    const texts = collect(WeekBars({ bars: withValues }), (element) => element.type === "Text").map(
      (text) => text.props?.children
    );

    expect(texts).toContain("45%");
    // 7 figure slots (one per column) + 7 weekday labels
    expect(texts).toHaveLength(14);

    const without = collect(WeekBars({ bars: bars() }), (element) => element.type === "Text");
    expect(without).toHaveLength(7);
  });
});
