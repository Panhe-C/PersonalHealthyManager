import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  Pressable: "Pressable",
  StyleSheet: {
    create: (styles: unknown) => styles
  },
  useColorScheme: () => "light",
  View: "View"
}));

import { MetricTile } from "./MetricTile";

describe("MetricTile", () => {
  it("renders as a pressable tile when an onPress handler is provided", () => {
    const element = MetricTile({ label: "恢复", value: "100%", onPress: () => undefined });

    expect(element.type).toBe("Pressable");
    expect(element.props.accessibilityRole).toBe("button");
  });
});
