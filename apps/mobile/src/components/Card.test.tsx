import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  Pressable: "Pressable",
  StyleSheet: {
    create: (styles: unknown) => styles
  },
  useColorScheme: () => "light",
  View: "View"
}));

import { Card } from "./Card";

describe("Card", () => {
  it("renders pressable cards when an onPress handler is provided", () => {
    const element = Card({ onPress: () => undefined, children: "Open" });

    expect(element.type).toBe("Pressable");
    expect(element.props.accessibilityRole).toBe("button");
  });
});
