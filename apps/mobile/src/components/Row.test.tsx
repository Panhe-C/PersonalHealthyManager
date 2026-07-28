import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  Pressable: "Pressable",
  StyleSheet: { create: (styles: unknown) => styles },
  useColorScheme: () => "light",
  View: "View"
}));

vi.mock("lucide-react-native", () => ({ ChevronRight: "ChevronRight" }));
vi.mock("./Text", () => ({ Text: "Text" }));

import { Row } from "./Row";

type Node = {
  type?: unknown;
  props?: { accessibilityState?: { disabled: boolean }; color?: string; children?: unknown };
};

function types(node: unknown): unknown[] {
  if (Array.isArray(node)) return node.flatMap(types);
  if (!node || typeof node !== "object") return [];
  const element = node as Node;
  return [element.type, ...types(element.props?.children)];
}

function texts(node: unknown): Node[] {
  if (Array.isArray(node)) return node.flatMap(texts);
  if (!node || typeof node !== "object") return [];
  const element = node as Node;
  const self = element.type === "Text" ? [element] : [];
  return [...self, ...texts(element.props?.children)];
}

describe("Row", () => {
  it("shows a disclosure chevron only when it can be tapped", () => {
    expect(types(Row({ title: "个人资料", onPress: () => undefined }))).toContain("ChevronRight");
    expect(types(Row({ title: "外观" }))).not.toContain("ChevronRight");
  });

  it("drops the chevron when the caller supplies its own trailing control", () => {
    const element = Row({ title: "自动同步", onPress: () => undefined, trailing: "Switch" });

    expect(types(element)).not.toContain("ChevronRight");
  });

  it("renders a tappable row as a Pressable and a static row as a View", () => {
    expect((Row({ title: "导出数据", onPress: () => undefined }) as Node).type).toBe("Pressable");
    expect((Row({ title: "单位" }) as Node).type).toBe("View");
  });

  it("paints destructive rows with the system red", () => {
    const [title] = texts(Row({ title: "退出登录", destructive: true, onPress: () => undefined }));

    expect(title.props?.color).toBe("#FF3B30");
  });

  it("reports a disabled tappable row to assistive technology", () => {
    const element = Row({ title: "同步中", disabled: true, onPress: () => undefined }) as Node;

    expect(element.props?.accessibilityState).toEqual({ disabled: true });
  });
});
