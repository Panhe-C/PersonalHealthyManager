/* eslint-disable import/first -- component imports must follow Vitest module mocks */
import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  StyleSheet: {
    create: (styles: unknown) => styles,
    hairlineWidth: 0.5
  },
  useColorScheme: () => "light",
  View: "View"
}));

vi.mock("./Text", () => ({ Text: "Text" }));

import { createElement } from "react";
import { InsetGroup, SEPARATOR_INSET } from "./InsetGroup";

type Node = { props?: { testID?: string; style?: unknown; children?: unknown } };

function collect(node: unknown, testID: string): Node[] {
  if (Array.isArray(node)) return node.flatMap((child) => collect(child, testID));
  if (!node || typeof node !== "object") return [];
  const element = node as Node;
  const self = element.props?.testID === testID ? [element] : [];
  return [...self, ...collect(element.props?.children, testID)];
}

function rows(count: number) {
  return Array.from({ length: count }, (_, index) => createElement("View", { key: `row-${index}` }));
}

describe("InsetGroup", () => {
  it("draws a separator between rows but never after the last one", () => {
    expect(collect(InsetGroup({ children: rows(3) }), "inset-separator")).toHaveLength(2);
    expect(collect(InsetGroup({ children: rows(1) }), "inset-separator")).toHaveLength(0);
  });

  it("ignores non-element children when counting separators", () => {
    const children = [...rows(2), null, false];

    expect(collect(InsetGroup({ children }), "inset-separator")).toHaveLength(1);
  });

  it("indents separators to clear the leading icon when asked", () => {
    const [separator] = collect(InsetGroup({ children: rows(2), insetSeparators: true }), "inset-separator");
    const [, dynamic] = separator.props?.style as [unknown, { marginLeft: number }];

    expect(dynamic.marginLeft).toBe(SEPARATOR_INSET);
  });

  it("leaves separators flush when there is no leading icon", () => {
    const [separator] = collect(InsetGroup({ children: rows(2) }), "inset-separator");
    const [, dynamic] = separator.props?.style as [unknown, { marginLeft: number }];

    expect(dynamic.marginLeft).toBe(0);
  });
});
