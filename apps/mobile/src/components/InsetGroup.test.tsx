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

function collectStyles(node: unknown): unknown[] {
  if (Array.isArray(node)) return node.flatMap(collectStyles);
  if (!node || typeof node !== "object") return [];
  const element = node as Node;
  return [element.props?.style, ...collectStyles(element.props?.children)];
}

function flatten(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) return Object.assign({}, ...style.map(flatten));
  return (style ?? {}) as Record<string, unknown>;
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

  it("lifts the card with the warm card shadow", () => {
    const card = collectStyles(InsetGroup({ children: rows(1) }))
      .map(flatten)
      .find((style) => style.shadowColor !== undefined);

    expect(card?.shadowColor).toBe("#6B675C");
    expect(card?.shadowOpacity).toBe(0.14);
    expect(card?.shadowRadius).toBe(24);
  });
});
