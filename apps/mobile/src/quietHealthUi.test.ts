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

const screens = [...tabs.map((tab) => `../app/(app)/(tabs)/${tab}.tsx`), ...detailScreens.map((screen) => `../app/(app)/${screen}.tsx`)];

describe("Quiet Health mobile UI", () => {
  it("uses the approved warm ivory, forest, sage, and terracotta palette", () => {
    const source = read("./theme/tokens.ts");

    expect(source).toContain('bg: "#F6F4EE"');
    expect(source).toContain('inkStrong: "#17231D"');
    expect(source).toContain('sage: "#718579"');
    expect(source).toContain('clay: "#C87958"');
  });

  it("uses a headerless five-tab flow in the approved order", () => {
    const source = read("../app/(app)/(tabs)/_layout.tsx");
    const order = ["today", "plan", "coach", "insights", "settings"].map((name) => source.indexOf(`name="${name}"`));

    expect(source).toContain("headerShown: false");
    expect(order.every((index) => index >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("gives each tab its approved distinctive composition", () => {
    expect(read("../app/(app)/(tabs)/today.tsx")).toContain("styles.readinessRing");
    expect(read("../app/(app)/(tabs)/plan.tsx")).toContain("styles.weekStrip");
    expect(read("../app/(app)/(tabs)/coach.tsx")).toContain("styles.composerDock");
    expect(read("../app/(app)/(tabs)/insights.tsx")).toContain("styles.trendChart");
    expect(read("../app/(app)/(tabs)/settings.tsx")).toContain("styles.settingsList");
  });

  it("removes metric-tile mosaics from the five primary tabs", () => {
    for (const tab of tabs) {
      expect(read(`../app/(app)/(tabs)/${tab}.tsx`)).not.toContain("<MetricTile");
    }
  });

  it("keeps one press-feedback opacity in the tokens and no hardcoded copies in screens", () => {
    expect(read("./theme/tokens.ts")).toContain("pressed: 0.72");

    for (const screen of screens) {
      expect(read(screen)).not.toMatch(/opacity: 0\.\d/);
    }
  });

  it("drops the unused blue accent from the palette", () => {
    expect(read("./theme/tokens.ts")).not.toContain("blue");
  });

  it("routes every confirmation and result through the in-app feedback layer", () => {
    for (const screen of screens) {
      expect(read(screen)).not.toContain("Alert.alert");
    }
  });

  it("gives pushed settings pages a sectioned, card-free composition", () => {
    for (const screen of detailScreens) {
      const source = read(`../app/(app)/${screen}.tsx`);

      expect(source).toContain("<Section");
      expect(source).not.toContain("components/Card");
    }
  });

  it("keeps labelled inputs on the shared TextField primitive", () => {
    for (const screen of detailScreens) {
      expect(read(`../app/(app)/${screen}.tsx`)).not.toContain("<TextInput");
    }
  });

  it("themes the pushed settings header instead of keeping the platform default", () => {
    const source = read("../app/(app)/_layout.tsx");

    expect(source).toContain("headerStyle: { backgroundColor: tokens.bg }");
    expect(source).toContain("headerShadowVisible: false");
    expect(source).toContain("headerTintColor: tokens.sage");
  });
});
