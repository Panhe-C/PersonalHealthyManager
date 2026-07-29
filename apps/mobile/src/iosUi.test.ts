import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

const tabs = ["today", "plan", "coach", "insights", "settings"];

const detailScreens = [
  "profile-settings",
  "account-security",
  "healthkit-settings",
  "model-settings",
  "connection-settings",
  "notification-settings",
  "goal-settings",
  "data-export"
];

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

  it("gives every tab its own native stack with a large title", () => {
    for (const tab of tabs) {
      const source = read(`../app/(app)/(tabs)/${tab}/_layout.tsx`);

      expect(source).toContain("useNativeHeaderOptions");
      expect(source).toContain('name="index"');
    }

    expect(read("./navigation/headerOptions.ts")).toContain("headerLargeTitleEnabled: true");
    expect(read("./navigation/headerOptions.ts")).toContain("headerBlurEffect");
  });

  it("pushes settings detail pages inside the settings tab so the tab bar stays", () => {
    const layout = read("../app/(app)/(tabs)/settings/_layout.tsx");

    for (const screen of detailScreens) {
      expect(layout).toContain(`name: "${screen}"`);
      expect(() => read(`../app/(app)/(tabs)/settings/${screen}.tsx`)).not.toThrow();
    }

    expect(layout).toContain("headerLargeTitleEnabled: false");
    const settings = read("../app/(app)/(tabs)/settings/index.tsx");
    for (const screen of detailScreens) {
      expect(settings).toContain(`/(app)/(tabs)/settings/${screen}`);
    }
    expect(settings).not.toContain('router.push("./');
  });

  it("drops the hand-rolled page header now that titles are native", () => {
    for (const tab of tabs) {
      expect(read(`../app/(app)/(tabs)/${tab}/index.tsx`)).not.toContain("PageHeader");
    }
  });

  it("floats a blurred tab bar at the system height", () => {
    const source = read("../app/(app)/(tabs)/_layout.tsx");

    expect(source).toContain("BlurView");
    expect(source).toContain("tabBarBackground");
    expect(source).toContain('position: "absolute"');
    expect(source).toContain("isReduceTransparencyEnabled");
    expect(source).toContain("reduceTransparencyChanged");
    expect(source).not.toContain("height: 68");
  });

  it("builds Today from grouped cards including the training checklist", () => {
    const source = read("../app/(app)/(tabs)/today/index.tsx");

    expect(source).toContain("<InsetGroup");
    expect(source).toContain("<CheckRow");
    expect(source).toContain("styles.heroCard");
    expect(source).not.toContain("<HairlineRow");
  });

  it("builds Plan from grouped cards with a card week strip", () => {
    const source = read("../app/(app)/(tabs)/plan/index.tsx");

    expect(source).toContain("<InsetGroup");
    expect(source).toContain("styles.weekStrip");
    expect(source).toContain("headerRight");
    expect(source).not.toContain("<HairlineRow");
  });

  it("builds Insights from a stat card, a chart card, and a grouped list", () => {
    const source = read("../app/(app)/(tabs)/insights/index.tsx");

    expect(source).toContain("<InsetGroup");
    expect(source).toContain("styles.statCard");
    expect(source).toContain("styles.chartCard");
    expect(source).not.toContain("<HairlineRow");
  });

  it("builds the settings tree from grouped cards", () => {
    const files = ["index", ...detailScreens];

    for (const file of files) {
      const source = read(`../app/(app)/(tabs)/settings/${file}.tsx`);

      expect(source).toContain("<InsetGroup");
      expect(source).not.toContain("<Section");
      expect(source).not.toContain("<HairlineRow");
      expect(source).not.toContain("<TextInput");
    }
  });

  it("leaves no Card users behind in coach", () => {
    expect(read("../app/(app)/(tabs)/coach/index.tsx")).not.toContain("components/Card");
  });

  it("keeps no Quiet Health compatibility layer", () => {
    const tokens = read("./theme/tokens.ts");

    expect(tokens).not.toContain("withLegacyAliases");
    expect(tokens).not.toContain("sage");
    expect(tokens).not.toContain("clay");
    expect(tokens).not.toContain("muted");
    expect(tokens).not.toContain("display:");
    expect(read("./components/Button.tsx")).not.toContain("aliases");
  });

  it("retires the primitives the grouped list replaced", () => {
    expect(() => read("./components/Card.tsx")).toThrow();
    expect(() => read("./components/Section.tsx")).toThrow();
    expect(read("./components/QuietHealth.tsx")).not.toContain("PageHeader");
    expect(read("./components/QuietHealth.tsx")).not.toContain("HairlineRow");
  });
});
