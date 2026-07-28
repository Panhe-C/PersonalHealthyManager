/* eslint-disable import/first -- component imports must follow Vitest module mocks */
import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  Pressable: "Pressable",
  StyleSheet: { create: (styles: unknown) => styles },
  useColorScheme: () => "light",
  View: "View"
}));

vi.mock("lucide-react-native", () => ({ Check: "Check" }));
vi.mock("./Text", () => ({ Text: "Text" }));

import { CheckRow } from "./CheckRow";

type Node = { type?: unknown; props?: { style?: unknown; children?: unknown } };

function types(node: unknown): unknown[] {
  if (Array.isArray(node)) return node.flatMap(types);
  if (!node || typeof node !== "object") return [];
  const element = node as Node;
  return [element.type, ...types(element.props?.children)];
}

function flatten(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) return Object.assign({}, ...style.map(flatten));
  return (style ?? {}) as Record<string, unknown>;
}

describe("CheckRow", () => {
  it("fills the box with the accessible green and shows a checkmark when completed", () => {
    const element = CheckRow({ label: "热身 10 分钟", status: "completed" });
    const [box] = (element.props?.children as Node[]) ?? [];

    expect(types(element)).toContain("Check");
    expect(flatten(box.props?.style).backgroundColor).toBe("#237F3C");
  });

  it("shows an empty outlined box when pending", () => {
    const element = CheckRow({ label: "主课 30 分钟", status: "pending" });
    const [box] = (element.props?.children as Node[]) ?? [];

    expect(types(element)).not.toContain("Check");
    expect(flatten(box.props?.style).backgroundColor).toBeUndefined();
    expect(flatten(box.props?.style).borderColor).toBe("#C6C6C8");
  });

  it("strikes through a skipped label", () => {
    const element = CheckRow({ label: "放松 5 分钟", status: "skipped" });
    const label = (element.props?.children as Node[])[1];

    expect(flatten(label.props?.style).textDecorationLine).toBe("line-through");
  });

  it("reports checkbox state to assistive technology", () => {
    const element = CheckRow({ label: "拉伸", status: "completed", onPress: () => undefined });

    expect(element.props?.accessibilityRole).toBe("checkbox");
    expect(element.props?.accessibilityState).toEqual({ checked: true, disabled: false });
  });

  it("reports skipped as a mixed checkbox state", () => {
    const element = CheckRow({ label: "放松", status: "skipped", onPress: () => undefined });

    expect(element.props?.accessibilityState).toEqual({ checked: "mixed", disabled: false });
    expect(element.props?.accessibilityValue).toEqual({ text: "已跳过" });
  });
});
