import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

describe("iOS native mobile UI", () => {
  it("uses the explicit iOS palette and accessible control pairs in both schemes", () => {
    const source = read("./theme/tokens.ts");

    expect(source).toContain('bg: "#F2F2F7"');
    expect(source).toContain('surface: "#FFFFFF"');
    expect(source).toContain('label: "#000000"');
    expect(source).toContain('labelSecondary: "rgba(60,60,67,0.6)"');
    expect(source).toContain('separator: "rgba(60,60,67,0.29)"');
    expect(source).toContain('tint: "#248A3D"');
    expect(source).toContain('controlFill: "#237F3C"');
    expect(source).toContain('controlLabel: "#FFFFFF"');
    expect(source).toContain('red: "#FF3B30"');
    expect(source).toContain('bg: "#000000"');
    expect(source).toContain('surface: "#1C1C1E"');
    expect(source).toContain('tint: "#30D158"');
    expect(source).toContain('controlLabel: "#000000"');
  });

  it("retires the Quiet Health palette", () => {
    const source = read("./theme/tokens.ts");

    expect(source).not.toContain("#F6F4EE");
    expect(source).not.toContain("#17231D");
    expect(source).not.toContain("#718579");
    expect(source).not.toContain("#C87958");
  });

  it("uses iOS text style metrics", () => {
    const source = read("./theme/tokens.ts");

    expect(source).toContain("largeTitle: { fontSize: 34, lineHeight: 41 }");
    expect(source).toContain("title1: { fontSize: 28, lineHeight: 34 }");
    expect(source).toContain("headline: { fontSize: 17, lineHeight: 22 }");
    expect(source).toContain("body: { fontSize: 17, lineHeight: 22 }");
    expect(source).toContain("footnote: { fontSize: 13, lineHeight: 18 }");
  });

  it("drops the Georgia editorial face for the system font", () => {
    expect(read("./components/Text.tsx")).not.toContain("Georgia");
  });

  it("keeps one press-feedback opacity in the tokens", () => {
    expect(read("./theme/tokens.ts")).toContain("pressed: 0.72");
  });

  it("lets the native header and the tab bar own the screen insets", () => {
    const source = read("./components/Screen.tsx");

    expect(source).toContain('contentInsetAdjustmentBehavior="automatic"');
    expect(source).toContain("BottomTabBarHeightContext");
    expect(source).not.toContain("SafeAreaView");
    expect(source).not.toContain("paddingHorizontal");
  });

  it("uses iOS control metrics for buttons and inputs", () => {
    expect(read("./components/Button.tsx")).toContain("minHeight: 50");
    expect(read("./components/TextField.tsx")).toContain("minHeight: 44");
    expect(read("./components/TextField.tsx")).toContain("useWindowDimensions");
    expect(read("./components/TextField.tsx")).toContain("fontScale >= 1.4");
  });
});
