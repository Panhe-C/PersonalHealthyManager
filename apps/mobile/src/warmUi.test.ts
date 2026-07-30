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

describe("warm card mobile UI", () => {
  it("uses the warm neutral palette with accessible control pairs in both schemes", () => {
    const source = read("./theme/tokens.ts");

    expect(source).toContain('bg: "#EFEEE9"');
    expect(source).toContain('surface: "#FBFBF7"');
    expect(source).toContain('label: "#1C1C1A"');
    expect(source).toContain('labelSecondary: "#8B8B83"');
    expect(source).toContain('labelTertiary: "rgba(139,139,131,0.6)"');
    expect(source).toContain('separator: "#D8D6CE"');
    expect(source).toContain('tint: "#3D7A55"');
    expect(source).toContain('tintFill: "#4C9A6B"');
    expect(source).toContain('controlFill: "#22221F"');
    expect(source).toContain('controlLabel: "#FBFBF7"');
    expect(source).toContain('fill: "#E3E1D9"');
    expect(source).toContain('red: "#C4534A"');
    expect(source).toContain('orange: "#E8823A"');
    expect(source).toContain('bg: "#1A1917"');
    expect(source).toContain('surface: "#252421"');
    expect(source).toContain('separator: "#3A3934"');
    expect(source).toContain('tint: "#5FA97E"');
    expect(source).toContain('tintFill: "#5FA97E"');
    expect(source).toContain('controlFill: "#F2F1EC"');
    expect(source).toContain('controlLabel: "#1C1C1A"');
    expect(source).toContain('fill: "#33322E"');
    expect(source).toContain('red: "#D96A60"');
    expect(source).toContain('orange: "#E8914F"');
  });

  it("retires the iOS palette", () => {
    const source = read("./theme/tokens.ts");

    expect(source).not.toContain("#F2F2F7");
    expect(source).not.toContain("#248A3D");
    expect(source).not.toContain("#237F3C");
    expect(source).not.toContain("#FF3B30");
  });

  it("uses the warm radius scale with a pill token", () => {
    const source = read("./theme/tokens.ts");

    expect(source).toContain("card: 28");
    expect(source).toContain("sheet: 32");
    expect(source).toContain("pill: 999");
    expect(source).toContain("bubble: 20");
  });

  it("exports the card shadow recipe", () => {
    const source = read("./theme/tokens.ts");

    expect(source).toContain("export function cardShadow");
    expect(source).toContain('"#6B675C"');
    expect(source).toContain("shadowOpacity: 0.14");
    expect(source).toContain("shadowRadius: 24");
    expect(source).toContain("elevation: 4");
  });

  it("keeps the text style metrics unchanged", () => {
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

  it("uses the shared control metrics for buttons and inputs", () => {
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

  it("floats a custom capsule tab bar with five equal tabs", () => {
    const layout = read("../app/(app)/(tabs)/_layout.tsx");

    expect(layout).toContain("tabBar={");
    expect(layout).toContain("FloatingTabBar");
    expect(layout).not.toContain("BlurView");

    const bar = read("./navigation/FloatingTabBar.tsx");
    expect(bar).toContain("BottomTabBarProps");
    expect(bar).not.toContain("快速记录");
    expect(bar).toContain("borderRadius: radius.pill");
  });

  it("hides the native header and builds Today from warm cards", () => {
    expect(read("../app/(app)/(tabs)/today/_layout.tsx")).toContain("headerShown: false");

    const source = read("../app/(app)/(tabs)/today/index.tsx");

    expect(source).toContain("WarmHeader");
    expect(source).toContain("ReadinessRing");
    expect(source).toContain("本周睡眠");
    expect(source).toContain("useSleepQuery");
    expect(source).toContain("训练清单");
    expect(source).toContain("CheckRow");
    expect(source).toContain("cardShadow");
    expect(source).toContain("查看本周计划");
  });

  it("hides the native header and builds Plan around warm cards", () => {
    expect(read("../app/(app)/(tabs)/plan/_layout.tsx")).toContain("headerShown: false");

    const source = read("../app/(app)/(tabs)/plan/index.tsx");

    expect(source).toContain("WarmHeader");
    expect(source).toContain("Sparkles");
    expect(source).toContain("生成或调整本周计划");
    expect(source).toContain("styles.weekStrip");
    expect(source).toContain("cardShadow");
    expect(source).toContain("<InsetGroup");
    expect(source).not.toContain("headerRight");
    expect(source).not.toContain("useNavigation");
  });

  it("hides the native header and builds Insights from warm cards", () => {
    expect(read("../app/(app)/(tabs)/insights/_layout.tsx")).toContain("headerShown: false");

    const source = read("../app/(app)/(tabs)/insights/index.tsx");

    expect(source).toContain("WarmHeader");
    expect(source).toContain("最近 8 天");
    expect(source).toContain("styles.statCard");
    expect(source).toContain("styles.chartCard");
    expect(source).toContain("cardShadow");
    expect(source).toContain("<InsetGroup");
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

  it("renders filled controls as pills with token-driven feedback", () => {
    const source = read("./components/Button.tsx");

    expect(source).toContain("borderRadius: radius.pill");
    expect(source).toContain("marginHorizontal: spacing.lg");
    expect(source).toContain("opacity.pressed");
    expect(source).toContain("opacity.disabled");
    expect(source).not.toContain("0.65");
    expect(source).not.toContain("0.45");
  });

  it("lifts grouped cards with the warm shadow and clears the floating capsule", () => {
    expect(read("./components/InsetGroup.tsx")).toContain("cardShadow");
    expect(read("./components/CheckRow.tsx")).toContain("tokens.tint");

    const screen = read("./components/Screen.tsx");
    expect(screen).toContain("bottomClearance");
    expect(screen).toContain("FLOATING_TAB_BAR_CLEARANCE");
  });

  it("retires the primitives the grouped list replaced", () => {
    expect(() => read("./components/Card.tsx")).toThrow();
    expect(() => read("./components/Section.tsx")).toThrow();
    expect(read("./components/QuietHealth.tsx")).not.toContain("PageHeader");
    expect(read("./components/QuietHealth.tsx")).not.toContain("HairlineRow");
  });

  it("shares one in-page warm header across the migrated tab roots", () => {
    const source = read("./components/WarmHeader.tsx");

    expect(source).toContain("export function WarmHeader");
    expect(source).toContain("export function WarmHeaderButton");
    expect(source).toContain('weight="strong"');
    expect(source).toContain("fontSize: 30");
    expect(source).toContain("cardShadow");
    expect(source).toContain("borderRadius: radius.pill");

    for (const tab of ["today", "plan", "insights", "settings"]) {
      expect(read(`../app/(app)/(tabs)/${tab}/index.tsx`)).toContain("WarmHeader");
    }
  });

  it("hides the native header and gives 我的 a warm profile card", () => {
    expect(read("../app/(app)/(tabs)/settings/_layout.tsx")).toContain("headerShown: false");

    const source = read("../app/(app)/(tabs)/settings/index.tsx");

    expect(source).toContain("WarmHeader");
    expect(source).toContain("账户与偏好");
    expect(source).toContain("styles.profileCard");
    expect(source).toContain("cardShadow");
    expect(source).toContain("<InsetGroup");
  });

  it("keeps the coach chrome native and finishes it with warm shadows", () => {
    expect(read("../app/(app)/(tabs)/coach/_layout.tsx")).not.toContain("headerShown: false");

    const source = read("../app/(app)/(tabs)/coach/index.tsx");

    expect(source).toContain("navigation.setOptions");
    expect(source).toContain("headerLeft");
    expect(source).toContain("cardShadow");
    expect(source).toContain("FLOATING_TAB_BAR_CLEARANCE");
    expect(source).not.toContain("BottomTabBarHeightContext");
  });

  it("labels each Today sleep bar and aligns the submit button to the card margin", () => {
    const source = read("../app/(app)/(tabs)/today/index.tsx");

    expect(source).toContain("accessible");
    expect(source).toContain("accessibilityLabel={sleepBarLabel(record)}");
    expect(source).toContain("小时");
    expect(source).toContain("styles.submitWrap");
  });

  it("aligns the settings detail pages with the in-page-header rhythm", () => {
    for (const screen of detailScreens) {
      const source = read(`../app/(app)/(tabs)/settings/${screen}.tsx`);

      expect(source).toContain("contentContainerStyle={{ paddingTop: spacing.lg }}");
    }
  });

  it("gives the auth screens the warm header metrics", () => {
    for (const screen of ["login", "register"]) {
      const source = read(`../app/(auth)/${screen}.tsx`);

      expect(source).toContain('size="title1"');
      expect(source).toContain('weight="strong"');
      expect(source).toContain("fontSize: 30");
      expect(source).not.toContain('size="largeTitle"');
    }
  });
});
