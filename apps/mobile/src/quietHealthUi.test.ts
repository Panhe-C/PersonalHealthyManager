import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

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
    const tabs = ["today", "plan", "coach", "insights", "settings"];

    for (const tab of tabs) {
      expect(read(`../app/(app)/(tabs)/${tab}.tsx`)).not.toContain("<MetricTile");
    }
  });
});
