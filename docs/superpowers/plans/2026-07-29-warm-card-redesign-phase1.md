# Warm Card Redesign Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the iOS-native look on the Expo app with the approved warm card design (prototype branch `prototype/warm-today-variants`, variant B compacted): a warm neutral palette with card shadows, pill-shaped controls, a floating capsule tab bar with a raised centre FAB, and a rebuilt Today tab (in-page header, horizontal readiness-ring hero card, weekly sleep bar card, training checklist card). Phase 1 covers tokens, the shared primitives the Today page touches, the tab bar, and the Today tab only; the other four tabs render half-migrated until phase 2.

**Architecture:** Same bottom-up order as the iOS redesign it replaces. (1) The theme layer swaps the palette values **in place** — every key keeps its name, plus one new `orange` key, a `radius.pill` token, and a `cardShadow(scheme)` export — so all ~existing `tokens.*` call sites keep compiling and every task can end green. (2) The shared primitives get restyled without signature changes: `Button` becomes a pill with token-driven opacities, `CheckRow`/`InsetGroup`/`Row` pick up the new palette, `InsetGroup` gains the card shadow, and `Screen` gains a `bottomClearance` prop that defaults to the capsule footprint inside the tab navigator. (3) The translucent system tab bar is replaced by a custom `FloatingTabBar` component rendered through the bottom-tabs `tabBar` render prop, so the five-route navigator state is preserved exactly. (4) The Today tab is rewritten after prototype variant B — hiding its native header and composing warm cards from the existing data hooks. `tsc` plus the rewritten `warmUi.test.ts` contract suite prove no call site or assertion was missed.

**Tech Stack:** Expo SDK 53, Expo Router 5.1, React Native 0.79, TypeScript, `@react-navigation/bottom-tabs` 7.18, `@react-navigation/native-stack` 7.17, react-native-safe-area-context, lucide-react-native, react-native-svg, Vitest.

## Global Constraints

- Preserve every existing API query, mutation, conversation action, and auth action. `completeTrainingTask` keeps receiving `{ actualLoad, items }` with the same shape. This is a visual and navigational refactor only.
- Keep the app Chinese-first.
- Keep exactly five tabs in this order: 今日、计划、教练、数据、我的.
- Token key names do not change except for the new `orange` key; untouched call sites must keep compiling. Untouched tabs render the warm palette with iOS-era layouts — accepted half-migrated state until phase 2 (see spec).
- Use the exact warm palette from the spec: Light `bg #EFEEE9`, `surface #FBFBF7`, `label #1C1C1A`, `labelSecondary #8B8B83`, `labelTertiary rgba(139,139,131,0.6)`, `separator`/`separatorOpaque #D8D6CE`, `tint #3D7A55`, `tintFill #4C9A6B`, `controlFill #22221F`, `controlLabel #FBFBF7`, `fill #E3E1D9`, `red #C4534A`, `redFill rgba(196,83,74,0.12)`, `destructiveFill #A8463E`, `destructiveLabel #FBFBF7`, `orange #E8823A`. Dark `bg #1A1917`, `surface #252421`, `label #F2F1EC`, `labelSecondary #8B8B83`, `labelTertiary rgba(139,139,131,0.6)`, `separator`/`separatorOpaque #3A3934`, `tint #5FA97E`, `tintFill #5FA97E`, `controlFill #F2F1EC`, `controlLabel #1C1C1A`, `fill #33322E`, `red #D96A60`, `redFill rgba(217,106,96,0.18)`, `destructiveFill #D96A60`, `destructiveLabel #1C1C1A`, `orange #E8914F`.
- `surfaceAlt` is not in the spec table; derive it as `#EFEEE9` (light, same as `bg`, mirroring the iOS light pair) and `#33322E` (dark, same as `fill`, lighter than `surface` like the iOS dark pair). Flagged in Self-Review.
- Radius: `card` 28, `sheet` 32, `bubble` 20, new `pill` 999. Shadows come only from `cardShadow(scheme)` — the iOS plan's "no decorative shadows" rule is revoked by the spec.
- Text styles keep their current keys and metrics. No `fontFamily` overrides anywhere. Headings on the Today page pass `weight="strong"` explicitly.
- No custom fonts, no gradients, no blur in the tab bar (Reduce Transparency becomes a no-op there). The native stack header (`headerBlurEffect`) stays untouched for the four un-migrated tabs.
- The custom tab bar must use the `tabBar` render prop of the existing `Tabs` navigator — never replace the navigator — so route state, deep links, and screen options are preserved.
- Every tab button and the FAB get `accessibilityRole="button"` and Chinese labels; the FAB label is 快速记录.
- Test style: contract tests read source strings (`readFileSync` + `toContain`); component tests mock `react-native` with `vi.mock` and call components as plain functions.
- Every task ends with `npx tsc -p apps/mobile/tsconfig.json --noEmit` passing and `npm test --workspace @hbm/mobile` green.

**Commands used throughout:**

- Focused test: `npm test --workspace @hbm/mobile -- <path>`
- Full mobile tests: `npm test --workspace @hbm/mobile`
- Typecheck: `npx tsc -p apps/mobile/tsconfig.json --noEmit`
- Lint: `npm run lint --workspace @hbm/mobile`

---

### Task 1: Warm colour tokens, radius scale, and card shadow

Swap the palette to the warm values, add the `orange` key and `radius.pill`, and export `cardShadow`. Key names survive, so the app immediately renders warm without touching any screen. The contract suite is renamed `warmUi.test.ts` and rewritten around the new palette; assertions for the untouched tabs carry over unchanged.

**Files:**
- Modify: `apps/mobile/src/theme/tokens.ts`
- Modify: `apps/mobile/src/components/CheckRow.test.tsx`, `apps/mobile/src/components/Row.test.tsx` (colour assertions track token values)
- Create: `apps/mobile/src/warmUi.test.ts`
- Delete: `apps/mobile/src/iosUi.test.ts`

**Interfaces:**
- Produces: `lightTokens` / `darkTokens` with the warm values, same keys as before plus `orange`.
- Produces: `radius` with `sm | card(28) | md | sheet(32) | bubble(20) | pill(999)`.
- Produces: `cardShadow(scheme: "light" | "dark")` returning `{ shadowColor, shadowOpacity: 0.14, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 4 }`.
- Consumes: nothing.

- [ ] **Step 1: Write the failing contract test**

Create `apps/mobile/src/warmUi.test.ts`:

```ts
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
```

The tab-bar and Today tests above are the still-passing iOS-era assertions; Task 3 and Task 4 replace them with the warm versions. Every other assertion must stay green for the whole plan.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --workspace @hbm/mobile -- src/warmUi.test.ts`

Expected: FAIL. The first assertion fails on `bg: "#EFEEE9"` because tokens still say `bg: "#F2F2F7"`.

- [ ] **Step 3: Rewrite the tokens**

Replace the whole of `apps/mobile/src/theme/tokens.ts`:

```ts
import { useColorScheme } from "react-native";

// Warm neutral palette (spec 2026-07-29-warm-card-redesign-phase1-design.md).
// Key names are unchanged from the iOS snapshot so every existing call site
// keeps compiling; `orange` is the only new key. `tint` is the text-safe green;
// `tintFill` is the brighter fill for rings and decorative arcs. Text-bearing
// filled controls use the explicit control/destructive foreground-background
// pairs below.
const lightBase = {
  bg: "#EFEEE9",
  surface: "#FBFBF7",
  surfaceAlt: "#EFEEE9",
  label: "#1C1C1A",
  labelSecondary: "#8B8B83",
  labelTertiary: "rgba(139,139,131,0.6)",
  separator: "#D8D6CE",
  separatorOpaque: "#D8D6CE",
  tint: "#3D7A55",
  tintFill: "#4C9A6B",
  controlFill: "#22221F",
  controlLabel: "#FBFBF7",
  fill: "#E3E1D9",
  red: "#C4534A",
  redFill: "rgba(196,83,74,0.12)",
  destructiveFill: "#A8463E",
  destructiveLabel: "#FBFBF7",
  orange: "#E8823A"
} as const;

type BaseTokens = { [K in keyof typeof lightBase]: string };

const darkBase: BaseTokens = {
  bg: "#1A1917",
  surface: "#252421",
  surfaceAlt: "#33322E",
  label: "#F2F1EC",
  labelSecondary: "#8B8B83",
  labelTertiary: "rgba(139,139,131,0.6)",
  separator: "#3A3934",
  separatorOpaque: "#3A3934",
  tint: "#5FA97E",
  tintFill: "#5FA97E",
  controlFill: "#F2F1EC",
  controlLabel: "#1C1C1A",
  fill: "#33322E",
  red: "#D96A60",
  redFill: "rgba(217,106,96,0.18)",
  destructiveFill: "#D96A60",
  destructiveLabel: "#1C1C1A",
  orange: "#E8914F"
};

export const lightTokens = lightBase;
export const darkTokens = darkBase;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32
} as const;

export const radius = {
  sm: 8,
  card: 28,
  md: 12,
  sheet: 32,
  bubble: 20,
  pill: 999
} as const;

export const opacity = {
  pressed: 0.72,
  disabled: 0.5
} as const;

/**
 * The one sanctioned shadow of the warm card language. Spread it onto card
 * surfaces; iOS clips shadows on views with `overflow: "hidden"`, so cards
 * that need clipping split into a shadow-bearing outer view and a clipping
 * inner view (see InsetGroup).
 */
export function cardShadow(scheme: "light" | "dark") {
  return {
    shadowColor: scheme === "dark" ? "#000000" : "#6B675C",
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4
  } as const;
}

// iOS text styles at the default Dynamic Type size; unchanged by the warm redesign.
export const textStyles = {
  largeTitle: { fontSize: 34, lineHeight: 41 },
  title1: { fontSize: 28, lineHeight: 34 },
  title2: { fontSize: 22, lineHeight: 28 },
  title3: { fontSize: 20, lineHeight: 25 },
  headline: { fontSize: 17, lineHeight: 22 },
  body: { fontSize: 17, lineHeight: 22 },
  callout: { fontSize: 16, lineHeight: 21 },
  subheadline: { fontSize: 15, lineHeight: 20 },
  footnote: { fontSize: 13, lineHeight: 18 },
  caption: { fontSize: 12, lineHeight: 16 },
  caption2: { fontSize: 11, lineHeight: 13 },
  metric: { fontSize: 40, lineHeight: 44 }
} as const;

export type ThemeTokens = { [K in keyof BaseTokens]: string };

export function useTheme(): { tokens: ThemeTokens; isDark: boolean } {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  return { tokens: isDark ? darkTokens : lightTokens, isDark };
}
```

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npm test --workspace @hbm/mobile -- src/warmUi.test.ts`

Expected: PASS, 20 tests.

- [ ] **Step 5: Update the component test colour assertions that track tokens**

The palette swap changes what `CheckRow` and `Row` render even though their source is untouched, so their tests must track the new token values now (Task 2 flips the `CheckRow` completed-box assertion again when the row moves to `tint`):

- In `apps/mobile/src/components/CheckRow.test.tsx`, change the completed-box assertion from `"#237F3C"` to `"#22221F"` (the new `controlFill`) and the pending-border assertion from `"#C6C6C8"` to `"#D8D6CE"` (the new `separatorOpaque`).
- In `apps/mobile/src/components/Row.test.tsx`, change the destructive-title assertion from `"#FF3B30"` to `"#C4534A"` (the new `red`).

Run: `npm test --workspace @hbm/mobile -- src/components`

Expected: PASS.

- [ ] **Step 6: Delete the superseded iOS contract test**

`apps/mobile/src/iosUi.test.ts` asserts the iOS palette and is fully superseded by `src/warmUi.test.ts`.

```bash
git rm apps/mobile/src/iosUi.test.ts
```

- [ ] **Step 7: Run the full suite and typecheck**

Run: `npm test --workspace @hbm/mobile`

Run: `npx tsc -p apps/mobile/tsconfig.json --noEmit`

Expected: both exit 0. The app now renders the warm palette with iOS-era radii and no card shadows.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/src/theme/tokens.ts apps/mobile/src/warmUi.test.ts apps/mobile/src/components/CheckRow.test.tsx apps/mobile/src/components/Row.test.tsx
git commit -m "feat(mobile): adopt warm card colour tokens, pill radius, and card shadow"
```

---

### Task 2: Restyle Button, CheckRow, InsetGroup, and Screen

Make filled controls pills with token-driven opacity feedback, recolour the checklist row, lift grouped cards with the warm shadow, and teach `Screen` to clear the floating capsule via a new `bottomClearance` prop. No signature changes beyond that one optional prop.

**Files:**
- Create: `apps/mobile/src/navigation/tabBarMetrics.ts`
- Modify: `apps/mobile/src/components/Button.tsx`
- Modify: `apps/mobile/src/components/CheckRow.tsx`
- Modify: `apps/mobile/src/components/InsetGroup.tsx`
- Modify: `apps/mobile/src/components/Screen.tsx`
- Modify: `apps/mobile/src/warmUi.test.ts`
- Modify: `apps/mobile/src/components/CheckRow.test.tsx`, `apps/mobile/src/components/InsetGroup.test.tsx`

**Interfaces:**
- Consumes: tokens, `radius.pill`, `cardShadow` from Task 1.
- Produces: `FLOATING_TAB_BAR_CLEARANCE = 110` in `src/navigation/tabBarMetrics.ts`.
- Produces: `Screen` accepting an optional `bottomClearance?: number`.
- Produces: unchanged `Button` / `CheckRow` / `InsetGroup` signatures.

- [ ] **Step 1: Add the failing contract assertions**

Append to the `describe` block in `apps/mobile/src/warmUi.test.ts`:

```ts
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
```

- [ ] **Step 2: Update the component test colour assertions**

In `apps/mobile/src/components/CheckRow.test.tsx`, change the completed-box assertion from `"#22221F"` to `"#3D7A55"` (the `tint` the row moves to in this task). The pending-border assertion already says `"#D8D6CE"` — the new `separator` equals the new `separatorOpaque` in light mode, so it needs no edit.

`Row.test.tsx` needs no change here: `Row` itself is untouched and its destructive assertion already tracks the new `red` from Task 1.

In `apps/mobile/src/components/InsetGroup.test.tsx`, append after the `collect` helper:

```tsx
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
```

and append inside the `describe` block:

```tsx
  it("lifts the card with the warm card shadow", () => {
    const card = collectStyles(InsetGroup({ children: rows(1) }))
      .map(flatten)
      .find((style) => style.shadowColor !== undefined);

    expect(card?.shadowColor).toBe("#6B675C");
    expect(card?.shadowOpacity).toBe(0.14);
    expect(card?.shadowRadius).toBe(24);
  });
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test --workspace @hbm/mobile -- src/warmUi.test.ts src/components`

Expected: FAIL — the new warmUi assertions fail on `borderRadius: radius.pill`, the `CheckRow` test fails expecting `#3D7A55` (the component still fills with `controlFill`), and the `InsetGroup` shadow test finds no `shadowColor`.

- [ ] **Step 4: Declare the capsule clearance constant**

Create `apps/mobile/src/navigation/tabBarMetrics.ts`:

```ts
/**
 * Vertical space screens must reserve at the bottom so content clears the
 * floating capsule tab bar: capsule (~52pt) + 16pt float offset + 20pt FAB
 * overlap + breathing room. The capsule is absolutely positioned, so
 * BottomTabBarHeightContext cannot measure it reliably; Screen uses this
 * explicit constant whenever it renders inside the tab navigator, and
 * FloatingTabBar (Task 3) is the layout it reserves space for.
 */
export const FLOATING_TAB_BAR_CLEARANCE = 110;
```

- [ ] **Step 5: Rewrite Button as a pill**

Replace the whole of `apps/mobile/src/components/Button.tsx`. This also fixes the two Task-3 deviations called out in the spec: the hardcoded `0.65`/`0.45` opacities become `opacity.pressed`/`opacity.disabled`, and the horizontal margin becomes `spacing.lg` (16):

```tsx
import { Pressable, StyleSheet, type PressableProps } from "react-native";
import { opacity, radius, spacing, useTheme } from "../theme/tokens";
import { Text } from "./Text";

type Variant = "filled" | "tinted" | "plain" | "destructive";

type ButtonProps = PressableProps & {
  label?: string;
  title?: string;
  variant?: Variant;
};

export function Button({
  label,
  title,
  variant = "filled",
  disabled,
  style,
  ...props
}: ButtonProps) {
  const { tokens } = useTheme();
  const backgroundColor =
    variant === "filled"
      ? tokens.controlFill
      : variant === "destructive"
        ? tokens.destructiveFill
        : variant === "tinted"
          ? tokens.fill
          : "transparent";
  const color =
    variant === "filled"
      ? tokens.controlLabel
      : variant === "destructive"
        ? tokens.destructiveLabel
        : tokens.tint;
  const buttonLabel = label ?? title ?? "";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      style={(state) => [
        styles.base,
        {
          backgroundColor,
          opacity: disabled ? opacity.disabled : state.pressed ? opacity.pressed : 1
        },
        typeof style === "function" ? style(state) : style
      ]}
      {...props}
    >
      <Text size="headline" style={{ color }}>
        {buttonLabel}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    borderRadius: radius.pill,
    justifyContent: "center",
    marginHorizontal: spacing.lg,
    minHeight: 50,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm
  }
});
```

- [ ] **Step 6: Recolour CheckRow**

In `apps/mobile/src/components/CheckRow.tsx`, replace the box style block:

```tsx
      <View
        style={[
          styles.box,
          completed
            ? { backgroundColor: tokens.controlFill, borderColor: tokens.controlFill }
            : { borderColor: tokens.separatorOpaque }
        ]}
      >
```

with:

```tsx
      <View
        style={[
          styles.box,
          completed
            ? { backgroundColor: tokens.tint, borderColor: tokens.tint }
            : { borderColor: tokens.separator }
        ]}
      >
```

Nothing else in the file changes: the check glyph keeps `tokens.controlLabel`, the skipped dash keeps `tokens.labelTertiary`.

- [ ] **Step 7: Add the card shadow to InsetGroup**

Replace the whole of `apps/mobile/src/components/InsetGroup.tsx`. iOS clips shadows on views with `overflow: "hidden"`, so the card splits into a shadow-bearing outer view and a clipping inner view; the separator logic is unchanged:

```tsx
import { Children, isValidElement, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { cardShadow, radius, spacing, useTheme } from "../theme/tokens";
import { Text } from "./Text";

/** Row padding (16) + icon slot (28) + gap (8), so separators clear the icon. */
export const SEPARATOR_INSET = 52;

/**
 * Warm card list section: a rounded surface card with the card shadow and
 * hairline separators between its rows. The shadow lives on the outer view
 * and the clipping on the inner one, because iOS does not draw a shadow on a
 * view that clips its own content. The separators live here rather than on
 * the rows so the last row never draws one.
 */
export function InsetGroup({
  header,
  footer,
  insetSeparators = false,
  children
}: {
  header?: string;
  footer?: string;
  insetSeparators?: boolean;
  children: ReactNode;
}) {
  const { tokens, isDark } = useTheme();
  const rows = Children.toArray(children).filter(isValidElement);

  return (
    <View style={styles.group}>
      {header ? (
        <Text size="footnote" color={tokens.labelSecondary} style={styles.header}>
          {header}
        </Text>
      ) : null}

      <View
        style={[
          styles.card,
          { backgroundColor: tokens.surface },
          cardShadow(isDark ? "dark" : "light")
        ]}
      >
        <View style={styles.clip}>
          {rows.map((row, index) => (
            <View key={row.key ?? index}>
              {row}
              {index < rows.length - 1 ? (
                <View
                  testID="inset-separator"
                  style={[
                    styles.separator,
                    { backgroundColor: tokens.separator, marginLeft: insetSeparators ? SEPARATOR_INSET : 0 }
                  ]}
                />
              ) : null}
            </View>
          ))}
        </View>
      </View>

      {footer ? (
        <Text size="footnote" color={tokens.labelSecondary} style={styles.footer}>
          {footer}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card },
  clip: { borderRadius: radius.card, overflow: "hidden" },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs },
  group: { marginHorizontal: spacing.lg },
  header: { paddingBottom: spacing.xs, paddingHorizontal: spacing.lg },
  separator: { height: StyleSheet.hairlineWidth }
});
```

- [ ] **Step 8: Teach Screen the capsule clearance**

Replace the whole of `apps/mobile/src/components/Screen.tsx`:

```tsx
import { useContext } from "react";
import { ScrollView, StyleSheet, type ScrollViewProps } from "react-native";
import { BottomTabBarHeightContext } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FLOATING_TAB_BAR_CLEARANCE } from "../navigation/tabBarMetrics";
import { spacing, useTheme } from "../theme/tokens";

/**
 * Scroll container for every screen. `contentInsetAdjustmentBehavior="automatic"`
 * still lets the native stack header own the top inset on the tabs that keep
 * one (Today hides its header and pads the top itself). The floating capsule
 * tab bar is absolutely positioned, so BottomTabBarHeightContext cannot
 * measure it; its presence only tells us we are inside the tab navigator,
 * which is where the explicit FLOATING_TAB_BAR_CLEARANCE applies. The auth
 * screens render outside the navigator and fall back to the safe-area inset.
 * Pass `bottomClearance` when a screen needs a different bottom pad.
 */
export function Screen({
  bottomClearance,
  contentContainerStyle,
  children,
  ...props
}: ScrollViewProps & { bottomClearance?: number }) {
  const { tokens } = useTheme();
  const tabBarHeight = useContext(BottomTabBarHeightContext);
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      automaticallyAdjustsScrollIndicatorInsets
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      style={{ backgroundColor: tokens.bg }}
      contentContainerStyle={[
        styles.content,
        {
          paddingBottom:
            bottomClearance ??
            (tabBarHeight === undefined ? insets.bottom + spacing.xl : FLOATING_TAB_BAR_CLEARANCE)
        },
        contentContainerStyle
      ]}
      {...props}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, gap: spacing.xl, paddingTop: spacing.sm }
});
```

- [ ] **Step 9: Run the focused tests, full suite, and typecheck**

Run: `npm test --workspace @hbm/mobile -- src/warmUi.test.ts src/components`

Expected: PASS, 22 warmUi tests plus all component tests.

Run: `npm test --workspace @hbm/mobile`

Run: `npx tsc -p apps/mobile/tsconfig.json --noEmit`

Expected: both exit 0.

- [ ] **Step 10: Commit**

```bash
git add apps/mobile/src/navigation/tabBarMetrics.ts apps/mobile/src/components/Button.tsx apps/mobile/src/components/CheckRow.tsx apps/mobile/src/components/InsetGroup.tsx apps/mobile/src/components/Screen.tsx apps/mobile/src/warmUi.test.ts apps/mobile/src/components/CheckRow.test.tsx apps/mobile/src/components/Row.test.tsx apps/mobile/src/components/InsetGroup.test.tsx
git commit -m "feat(mobile): restyle shared primitives for warm cards"
```

---

### Task 3: Floating capsule tab bar

Replace the translucent system tab bar with a custom floating capsule rendered through the `tabBar` render prop: five tabs in the existing order, icon-only, a raised centre FAB that jumps to the Coach tab as the phase-1 placeholder action, and Chinese accessibility labels throughout.

**Files:**
- Create: `apps/mobile/src/navigation/FloatingTabBar.tsx`
- Create: `apps/mobile/src/navigation/FloatingTabBar.test.tsx`
- Modify: `apps/mobile/app/(app)/(tabs)/_layout.tsx`
- Modify: `apps/mobile/src/warmUi.test.ts`

**Interfaces:**
- Consumes: `cardShadow`, `radius.pill`, tokens from Task 1; reserves the `FLOATING_TAB_BAR_CLEARANCE` from Task 2.
- Produces: `FloatingTabBar(props: BottomTabBarProps)`, rendered by the tabs layout; centre-slot convention: route index 2 (coach) is a spacer whose press target is the FAB.

- [ ] **Step 1: Write the failing FloatingTabBar test**

Create `apps/mobile/src/navigation/FloatingTabBar.test.tsx`:

```tsx
/* eslint-disable import/first -- component imports must follow Vitest module mocks */
import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  Pressable: "Pressable",
  StyleSheet: { create: (styles: unknown) => styles },
  useColorScheme: () => "light",
  View: "View"
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ bottom: 34, left: 0, right: 0, top: 0 })
}));

vi.mock("lucide-react-native", () => ({ Plus: "Plus" }));

import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { FloatingTabBar } from "./FloatingTabBar";

type Node = {
  type?: unknown;
  props?: {
    accessibilityLabel?: string;
    accessibilityRole?: string;
    onPress?: () => void;
    children?: unknown;
  };
};

function collect(node: unknown, predicate: (element: Node) => boolean): Node[] {
  if (Array.isArray(node)) return node.flatMap((child) => collect(child, predicate));
  if (!node || typeof node !== "object") return [];
  const element = node as Node;
  const self = predicate(element) ? [element] : [];
  return [...self, ...collect(element.props?.children, predicate)];
}

const tabNames = ["today", "plan", "coach", "insights", "settings"] as const;
const tabTitles: Record<(typeof tabNames)[number], string> = {
  today: "今日",
  plan: "计划",
  coach: "教练",
  insights: "数据",
  settings: "我的"
};

function makeProps() {
  const routes = tabNames.map((name) => ({ key: `${name}-key`, name, params: undefined }));
  const descriptors = Object.fromEntries(
    routes.map((route) => [route.key, { options: { title: tabTitles[route.name] } }])
  );
  const navigation = {
    emit: vi.fn(() => ({ defaultPrevented: false })),
    navigate: vi.fn()
  };
  const props = { state: { index: 0, routes }, descriptors, navigation } as unknown as BottomTabBarProps;

  return { navigation, props };
}

function buttons(tree: unknown): Node[] {
  return collect(tree, (element) => element.type === "Pressable");
}

describe("FloatingTabBar", () => {
  it("renders the four visible tabs with Chinese labels and leaves the centre slot to the FAB", () => {
    const tree = FloatingTabBar(makeProps().props);

    expect(buttons(tree).map((button) => button.props?.accessibilityLabel)).toEqual([
      "今日",
      "计划",
      "数据",
      "我的",
      "快速记录"
    ]);
    for (const button of buttons(tree)) {
      expect(button.props?.accessibilityRole).toBe("button");
    }
  });

  it("emits tabPress but does not navigate when the focused tab is pressed", () => {
    const { navigation, props } = makeProps();
    const [today] = buttons(FloatingTabBar(props));

    today.props?.onPress?.();

    expect(navigation.emit).toHaveBeenCalledWith({
      type: "tabPress",
      target: "today-key",
      canPreventDefault: true
    });
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it("navigates to an unfocused tab when pressed", () => {
    const { navigation, props } = makeProps();
    const [, plan] = buttons(FloatingTabBar(props));

    plan.props?.onPress?.();

    expect(navigation.navigate).toHaveBeenCalledWith("plan", undefined);
  });

  it("sends the FAB to the coach tab as the phase-1 placeholder action", () => {
    const { navigation, props } = makeProps();
    const fab = buttons(FloatingTabBar(props)).find(
      (button) => button.props?.accessibilityLabel === "快速记录"
    );

    fab?.props?.onPress?.();

    expect(navigation.navigate).toHaveBeenCalledWith("coach", undefined);
  });
});
```

- [ ] **Step 2: Replace the iOS tab-bar contract test**

In `apps/mobile/src/warmUi.test.ts`, delete the whole `floats a blurred tab bar at the system height` test (the one asserting `BlurView`, `tabBarBackground`, and `isReduceTransparencyEnabled`) and add:

```ts
  it("floats a custom capsule tab bar with a raised FAB", () => {
    const layout = read("../app/(app)/(tabs)/_layout.tsx");

    expect(layout).toContain("tabBar={");
    expect(layout).toContain("FloatingTabBar");
    expect(layout).not.toContain("BlurView");

    const bar = read("./navigation/FloatingTabBar.tsx");
    expect(bar).toContain("BottomTabBarProps");
    expect(bar).toContain('accessibilityLabel="快速记录"');
    expect(bar).toContain("borderRadius: radius.pill");
  });
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test --workspace @hbm/mobile -- src/navigation/FloatingTabBar.test.tsx src/warmUi.test.ts`

Expected: FAIL with "Failed to resolve import ./FloatingTabBar" from the component test, and the warmUi assertion fails on `tabBar={` in the layout.

- [ ] **Step 4: Implement FloatingTabBar**

Create `apps/mobile/src/navigation/FloatingTabBar.tsx`:

```tsx
import { Pressable, StyleSheet, View } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Plus } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { cardShadow, radius, useTheme } from "../theme/tokens";

/**
 * Index of the centre route (coach). Its capsule slot is a spacer: the raised
 * FAB sits on top of it and carries the navigation, which is why the FAB's
 * phase-1 placeholder action and the centre tab can be the same destination.
 */
const FAB_ROUTE_INDEX = 2;

/**
 * Warm floating capsule tab bar. Rendered through the bottom-tabs `tabBar`
 * render prop so the navigator keeps its five-route state, screen options,
 * and deep links untouched. The bar is absolutely positioned above the home
 * indicator; screens clear it via FLOATING_TAB_BAR_CLEARANCE (Screen.tsx).
 * No blur is involved, so Reduce Transparency needs no special handling.
 */
export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { tokens, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const shadow = cardShadow(isDark ? "dark" : "light");
  const coachRoute = state.routes[FAB_ROUTE_INDEX];

  return (
    <View pointerEvents="box-none" style={[styles.dock, { bottom: insets.bottom + 16 }]}>
      <View style={[styles.capsule, { backgroundColor: tokens.surface }, shadow]}>
        {state.routes.map((route, index) => {
          if (index === FAB_ROUTE_INDEX) {
            return <View key={route.key} pointerEvents="none" style={styles.tabSlot} />;
          }

          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const color = focused ? tokens.controlFill : tokens.labelSecondary;
          const label =
            typeof options.tabBarAccessibilityLabel === "string"
              ? options.tabBarAccessibilityLabel
              : typeof options.title === "string"
                ? options.title
                : route.name;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              onPress={onPress}
              style={styles.tabSlot}
            >
              {options.tabBarIcon?.({ focused, color, size: 24 })}
            </Pressable>
          );
        })}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="快速记录"
        onPress={() => {
          if (coachRoute) {
            navigation.navigate(coachRoute.name, coachRoute.params);
          }
        }}
        style={[styles.fab, { backgroundColor: tokens.controlFill }, shadow]}
      >
        <Plus color={tokens.controlLabel} size={26} strokeWidth={2.2} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  capsule: {
    alignItems: "center",
    alignSelf: "stretch",
    borderRadius: radius.pill,
    flexDirection: "row",
    paddingVertical: 14
  },
  dock: { left: 20, position: "absolute", right: 20 },
  fab: {
    alignItems: "center",
    alignSelf: "center",
    borderRadius: radius.pill,
    height: 60,
    justifyContent: "center",
    position: "absolute",
    top: -20,
    width: 60
  },
  tabSlot: { alignItems: "center", flex: 1, justifyContent: "center", minHeight: 44 }
});
```

- [ ] **Step 5: Rewrite the tab layout**

Replace the whole of `apps/mobile/app/(app)/(tabs)/_layout.tsx`. The `BlurView`/Reduce-Transparency machinery goes away with the blur itself; the five `Tabs.Screen` declarations keep their titles and icons so the capsule can render them:

```tsx
import { Tabs } from "expo-router";
import {
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  MessageCircle,
  Settings as SettingsIcon,
  Sun
} from "lucide-react-native";
import { FloatingTabBar } from "../../../src/navigation/FloatingTabBar";

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        // Detach the bar from the layout flow so screen content scrolls under
        // the floating capsule; FloatingTabBar positions itself above the home
        // indicator and Screen reserves the clearance.
        tabBarStyle: { position: "absolute" }
      }}
    >
      <Tabs.Screen
        name="today"
        options={{
          title: "今日",
          tabBarIcon: ({ color }) => <Sun color={color} size={24} strokeWidth={1.9} />
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          title: "计划",
          tabBarIcon: ({ color }) => <CalendarDays color={color} size={24} strokeWidth={1.9} />
        }}
      />
      <Tabs.Screen
        name="coach"
        options={{
          title: "教练",
          tabBarIcon: ({ color }) => <MessageCircle color={color} size={24} strokeWidth={1.9} />
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: "数据",
          tabBarIcon: ({ color }) => (
            <ChartNoAxesColumnIncreasing color={color} size={24} strokeWidth={1.9} />
          )
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "我的",
          tabBarIcon: ({ color }) => <SettingsIcon color={color} size={24} strokeWidth={1.9} />
        }}
      />
    </Tabs>
  );
}
```

- [ ] **Step 6: Run the focused tests to verify they pass**

Run: `npm test --workspace @hbm/mobile -- src/navigation/FloatingTabBar.test.tsx src/warmUi.test.ts`

Expected: PASS, 4 new component tests plus 22 warmUi tests.

- [ ] **Step 7: Verify on the simulator**

Run: `npm run ios --workspace @hbm/mobile`

Check: the capsule floats above the home indicator with the FAB straddling its top edge; tapping 计划/数据/我的 switches tabs and the active glyph turns dark (`controlFill`); the FAB jumps to 教练; no blur remains behind the bar. `expo-blur` needs no rebuild because it stays installed — it is simply no longer imported.

- [ ] **Step 8: Run the full suite and typecheck**

Run: `npm test --workspace @hbm/mobile`

Run: `npx tsc -p apps/mobile/tsconfig.json --noEmit`

Expected: both exit 0.

- [ ] **Step 9: Commit**

```bash
git add apps/mobile/src/navigation/FloatingTabBar.tsx apps/mobile/src/navigation/FloatingTabBar.test.tsx "apps/mobile/app/(app)/(tabs)/_layout.tsx" apps/mobile/src/warmUi.test.ts
git commit -m "feat(mobile): replace the system tab bar with a floating capsule and FAB"
```

---

### Task 4: Rebuild the Today tab as warm cards

Rewrite Today after prototype variant B (compacted): hide its native header, draw the in-page header with a calendar link to Plan, lay the readiness ring and three metrics side by side in the hero card, add the weekly sleep bar card fed by `useSleepQuery`, and rebuild the training checklist as a warm card that keeps the 实际负荷 `TextField`, the `nextChecklistStatus` cycling, and the submit `Button` exactly as they behave today.

**Files:**
- Modify: `apps/mobile/src/components/QuietHealth.tsx` (rewrite `ReadinessRing` as the 116pt ring, delete the now-unused `MetricStrip`)
- Modify: `apps/mobile/app/(app)/(tabs)/today/_layout.tsx`
- Modify: `apps/mobile/app/(app)/(tabs)/today/index.tsx`
- Modify: `apps/mobile/src/warmUi.test.ts`

**Interfaces:**
- Consumes: `cardShadow`, `radius`, `spacing` from Task 1; `Screen`, `Button`, `CheckRow`, `TextField` from Task 2; `useTodayOverviewQuery`, `useSleepQuery`, `completeTrainingTask` (unchanged).
- Produces: unchanged data behaviour — `completeTrainingTask` still receives `{ actualLoad, items }` with the same shape, and `trainingFlows.test.ts` keeps passing untouched.

- [ ] **Step 1: Replace the Today contract test**

In `apps/mobile/src/warmUi.test.ts`, delete the whole `builds Today from grouped cards including the training checklist` test and add:

```ts
  it("hides the native header and builds Today from warm cards", () => {
    expect(read("../app/(app)/(tabs)/today/_layout.tsx")).toContain("headerShown: false");

    const source = read("../app/(app)/(tabs)/today/index.tsx");

    expect(source).toContain("ReadinessRing");
    expect(source).toContain("本周睡眠");
    expect(source).toContain("useSleepQuery");
    expect(source).toContain("训练清单");
    expect(source).toContain("CheckRow");
    expect(source).toContain("cardShadow");
    expect(source).toContain("查看本周计划");
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test --workspace @hbm/mobile -- src/warmUi.test.ts`

Expected: FAIL — `today/_layout.tsx` has no `headerShown: false` yet.

- [ ] **Step 3: Rewrite ReadinessRing and drop MetricStrip**

Replace the whole of `apps/mobile/src/components/QuietHealth.tsx`. The ring shrinks from the centered 188pt version to the horizontal-layout 116pt / stroke-10 ring with named geometry constants, and `MetricStrip` is deleted (Today was its only caller; the hero now lays out its own metric rows). `TrendChart` is untouched — Insights still uses it:

```tsx
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { useTheme } from "../theme/tokens";
import { Text } from "./Text";

// Readiness ring geometry (spec: 116pt ring, 10pt stroke). Named once so the
// arc math below stays readable.
const RING_SIZE = 116;
const RING_STROKE = 10;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CENTER = RING_SIZE / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function ReadinessRing({ value, label = "准备就绪" }: { value: number; label?: string }) {
  const { tokens } = useTheme();
  const safeValue = Math.max(0, Math.min(100, value));

  return (
    <View style={styles.ringWrap}>
      <Svg width={RING_SIZE} height={RING_SIZE}>
        <Circle
          cx={RING_CENTER}
          cy={RING_CENTER}
          r={RING_RADIUS}
          fill="none"
          stroke={tokens.fill}
          strokeWidth={RING_STROKE}
        />
        <Circle
          cx={RING_CENTER}
          cy={RING_CENTER}
          r={RING_RADIUS}
          fill="none"
          stroke={tokens.tint}
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          strokeDasharray={`${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
          strokeDashoffset={RING_CIRCUMFERENCE * (1 - safeValue / 100)}
          rotation="-90"
          origin={`${RING_CENTER}, ${RING_CENTER}`}
        />
      </Svg>
      <View style={styles.ringCenter}>
        <Text size="title1" weight="strong" tabularNums>
          {safeValue}
        </Text>
        <Text size="caption2" color={tokens.labelSecondary}>
          {label}
        </Text>
      </View>
    </View>
  );
}

export function TrendChart({ values }: { values: number[] }) {
  const { tokens } = useTheme();
  const safe = values.length > 1 ? values : [0, 0];
  const width = 320;
  const height = 150;
  const min = Math.min(...safe, 0);
  const max = Math.max(...safe, 100);
  const points = safe.map((value, index) => {
    const x = 12 + (index * (width - 24)) / (safe.length - 1);
    const y = height - 14 - ((value - min) / Math.max(1, max - min)) * (height - 28);
    return { x, y };
  });
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");

  return (
    <View style={styles.chartWrap}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <Line x1="12" y1={height - 14} x2={width - 12} y2={height - 14} stroke={tokens.separator} strokeWidth="1" />
        <Path d={path} fill="none" stroke={tokens.tint} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point, index) => <Circle key={index} cx={point.x} cy={point.y} r="5" fill={tokens.surface} stroke={tokens.tint} strokeWidth="2.5" />)}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  chartWrap: { width: "100%" },
  ringCenter: { alignItems: "center", position: "absolute" },
  ringWrap: { alignItems: "center", height: RING_SIZE, justifyContent: "center", width: RING_SIZE }
});
```

- [ ] **Step 4: Hide the native header for Today only**

Replace the whole of `apps/mobile/app/(app)/(tabs)/today/_layout.tsx`:

```tsx
import { Stack } from "expo-router";
import { useNativeHeaderOptions } from "../../../../src/navigation/headerOptions";

export default function TodayLayout() {
  const screenOptions = useNativeHeaderOptions();

  return (
    <Stack screenOptions={screenOptions}>
      {/* Today draws its own in-page header (date overline + 今日 title), so
          the native large title is hidden here and only here. The other four
          tabs keep theirs until phase 2. */}
      <Stack.Screen name="index" options={{ title: "今日", headerShown: false }} />
    </Stack>
  );
}
```

- [ ] **Step 5: Rewrite the Today screen**

Replace the whole of `apps/mobile/app/(app)/(tabs)/today/index.tsx`:

```tsx
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Footprints, Moon } from "lucide-react-native";
import { Screen } from "../../../../src/components/Screen";
import { Text } from "../../../../src/components/Text";
import { Button } from "../../../../src/components/Button";
import { CheckRow } from "../../../../src/components/CheckRow";
import { useFeedback } from "../../../../src/components/Feedback";
import { EmptyState, Spinner } from "../../../../src/components/States";
import { TextField } from "../../../../src/components/TextField";
import { ReadinessRing } from "../../../../src/components/QuietHealth";
import { useSleepQuery, useTodayOverviewQuery } from "../../../../src/api/hooks";
import { completeTrainingTask } from "../../../../src/api/training";
import {
  APP_TIME_ZONE,
  formatDateLabel,
  formatDuration,
  percentLabel
} from "../../../../src/ui/format";
import { cardShadow, radius, spacing, useTheme } from "../../../../src/theme/tokens";
import type { TodayOverview } from "../../../../src/api/schemas";

type TodayTask = TodayOverview["todayTasks"][number];
type ChecklistStatus = TodayTask["checklistItems"][number]["status"];

// Sleep bar geometry: bars scale against the longest night shown instead of
// the prototype's `hours * 7` multiplier.
const BAR_MAX_HEIGHT = 72;
const BAR_MIN_HEIGHT = 6;
const BAR_WIDTH = 18;
const BAR_RADIUS = 6;

const weekdayFormat = new Intl.DateTimeFormat("zh-CN", {
  timeZone: APP_TIME_ZONE,
  weekday: "short"
});

function weekdayLabel(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : weekdayFormat.format(date);
}

export default function TodayTab() {
  const { data, isLoading, error } = useTodayOverviewQuery();
  const sleep = useSleepQuery(7);
  const { tokens, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const shadow = cardShadow(isDark ? "dark" : "light");
  const recovery = typeof data?.latestRecovery?.recoveryPercent === "number" ? data.latestRecovery.recoveryPercent : 0;
  const sleepMinutes = typeof data?.latestSleep?.durationMinutes === "number" ? data.latestSleep.durationMinutes : null;
  const activityMinutes = data?.todayTasks.reduce((sum, task) => sum + task.durationMinutes, 0) ?? 0;
  const focusTask = data?.todayTasks[0];
  // The API returns the newest night first; the card renders oldest to newest.
  const weekSleep = [...(sleep.data ?? [])].slice(0, 7).reverse();
  const maxSleep = Math.max(...weekSleep.map((record) => record.durationMinutes), 1);
  const averageSleep = weekSleep.length
    ? Math.round(weekSleep.reduce((sum, record) => sum + record.durationMinutes, 0) / weekSleep.length)
    : null;

  return (
    <Screen contentContainerStyle={{ gap: spacing.lg, paddingTop: insets.top + spacing.lg }}>
      {isLoading ? <Spinner /> : error ? (
        <EmptyState title="今日数据加载失败" description="请确认后端和登录状态仍然可用。" />
      ) : data ? (
        <>
          {/* In-page header: the native header is hidden for this tab, so the
              safe-area top inset is applied manually via contentContainerStyle. */}
          <View style={styles.headerRow}>
            <View>
              <Text size="footnote" color={tokens.labelSecondary}>
                {`${formatDateLabel(data.date)} · ${weekdayLabel(data.date)}`}
              </Text>
              <Text size="title1" weight="strong" style={styles.pageTitle}>
                今日
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="查看本周计划"
              onPress={() => router.push("/(app)/(tabs)/plan")}
              style={[styles.circleButton, { backgroundColor: tokens.surface }, shadow]}
            >
              <CalendarDays color={tokens.label} size={18} strokeWidth={1.8} />
            </Pressable>
          </View>

          {/* Hero: readiness ring left, three metrics right, hairline between. */}
          <View style={[styles.heroCard, { backgroundColor: tokens.surface }, shadow]}>
            <ReadinessRing
              value={recovery}
              label={recovery >= 75 ? "准备就绪" : recovery >= 50 ? "适度训练" : "优先恢复"}
            />
            <View style={[styles.heroDivider, { backgroundColor: tokens.separator }]} />
            <View style={styles.heroMetrics}>
              {[
                { label: "睡眠", value: formatDuration(sleepMinutes) },
                { label: "恢复", value: percentLabel(recovery) },
                { label: "活动", value: activityMinutes ? `${activityMinutes} 分` : "—" }
              ].map((metric, index) => (
                <View
                  key={metric.label}
                  style={[
                    styles.heroMetricRow,
                    index > 0
                      ? { borderTopColor: tokens.separator, borderTopWidth: StyleSheet.hairlineWidth }
                      : null
                  ]}
                >
                  <Text size="footnote" color={tokens.labelSecondary}>
                    {metric.label}
                  </Text>
                  <Text size="body" weight="strong">
                    {metric.value}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Weekly sleep bars, newest night on the right in controlFill. */}
          <View style={[styles.card, { backgroundColor: tokens.surface }, shadow]}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderLeft}>
                <View style={[styles.iconTile, { backgroundColor: tokens.fill }]}>
                  <Moon color={tokens.label} size={16} strokeWidth={1.8} />
                </View>
                <Text size="callout" weight="semibold">
                  本周睡眠
                </Text>
              </View>
              <Text size="footnote" color={tokens.labelSecondary}>
                {averageSleep === null ? "暂无记录" : `平均 ${formatDuration(averageSleep)}`}
              </Text>
            </View>
            {weekSleep.length ? (
              <View style={styles.barRow}>
                {weekSleep.map((record, index) => (
                  <View key={record.id} style={styles.barCol}>
                    <View
                      style={[
                        styles.bar,
                        {
                          backgroundColor:
                            index === weekSleep.length - 1 ? tokens.controlFill : tokens.fill,
                          height: Math.max(
                            BAR_MIN_HEIGHT,
                            Math.round((record.durationMinutes / maxSleep) * BAR_MAX_HEIGHT)
                          )
                        }
                      ]}
                    />
                    <Text size="caption2" color={tokens.labelSecondary}>
                      {weekdayLabel(record.date).replace("周", "")}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text size="footnote" color={tokens.labelSecondary}>
                同步 Apple 健康后展示最近几晚的睡眠。
              </Text>
            )}
          </View>

          {focusTask ? <TodayChecklist task={focusTask} shadow={shadow} /> : (
            <View style={[styles.card, { backgroundColor: tokens.surface }, shadow]}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardHeaderLeft}>
                  <View style={[styles.iconTile, { backgroundColor: tokens.fill }]}>
                    <Footprints color={tokens.orange} size={16} strokeWidth={1.8} />
                  </View>
                  <Text size="callout" weight="semibold">
                    训练清单
                  </Text>
                </View>
              </View>
              <Text size="footnote" color={tokens.labelSecondary}>
                {data.activePlanId ? "今天没有安排训练任务。" : "生成计划后，今日训练会显示在这里。"}
              </Text>
            </View>
          )}
        </>
      ) : null}
    </Screen>
  );
}

function nextChecklistStatus(status: ChecklistStatus): ChecklistStatus {
  if (status === "pending") return "completed";
  if (status === "completed") return "skipped";
  return "pending";
}

function TodayChecklist({
  task,
  shadow
}: {
  task: TodayTask;
  shadow: ReturnType<typeof cardShadow>;
}) {
  const { tokens } = useTheme();
  const queryClient = useQueryClient();
  const { notify } = useFeedback();
  const [actualLoad, setActualLoad] = useState("");
  const [statuses, setStatuses] = useState<Record<string, ChecklistStatus>>(
    () => Object.fromEntries(task.checklistItems.map((item) => [item.id, item.status])) as Record<string, ChecklistStatus>
  );
  const alreadyRecorded = task.status !== "planned" && task.status !== "pending";
  const completedCount = task.checklistItems.filter(
    (item) => (statuses[item.id] ?? item.status) === "completed"
  ).length;
  const completionMutation = useMutation({
    mutationFn: () => completeTrainingTask(task.id, {
      actualLoad: actualLoad.trim() ? Number(actualLoad) : undefined,
      items: task.checklistItems.map((item) => ({ id: item.id, label: item.label, status: statuses[item.id] ?? item.status }))
    }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["today"] });
      void queryClient.invalidateQueries({ queryKey: ["plan", "active"] });
      notify({ title: "已记录", description: "训练完成情况已同步到计划。" });
    },
    onError: (err) => notify({ tone: "danger", title: "提交失败", description: err instanceof Error ? err.message : "请稍后重试。" })
  });

  return (
    <>
      <View style={[styles.listCard, { backgroundColor: tokens.surface }, shadow]}>
        <View style={styles.listCardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={[styles.iconTile, { backgroundColor: tokens.fill }]}>
              <Footprints color={tokens.orange} size={16} strokeWidth={1.8} />
            </View>
            <Text size="callout" weight="semibold">
              训练清单
            </Text>
          </View>
          <Text size="footnote" color={tokens.labelSecondary}>
            {completedCount}/{task.checklistItems.length}
          </Text>
        </View>
        {task.checklistItems.map((item, index) => (
          <View key={item.id}>
            {index > 0 ? <View style={[styles.rowDivider, { backgroundColor: tokens.separator }]} /> : null}
            <CheckRow
              label={item.label}
              status={statuses[item.id] ?? item.status}
              disabled={alreadyRecorded || completionMutation.isPending}
              onPress={() =>
                setStatuses((items) => ({
                  ...items,
                  [item.id]: nextChecklistStatus(statuses[item.id] ?? item.status)
                }))
              }
            />
          </View>
        ))}
        <View style={[styles.rowDivider, { backgroundColor: tokens.separator }]} />
        <TextField
          label="实际负荷"
          value={actualLoad}
          onChange={setActualLoad}
          placeholder="可选"
          keyboardType="number-pad"
          editable={!alreadyRecorded && !completionMutation.isPending}
        />
        <Text size="footnote" color={tokens.labelSecondary} style={styles.listCardFooter}>
          {alreadyRecorded ? "本次训练已记录。" : "点按可在完成、跳过、待办之间切换。"}
        </Text>
      </View>

      <Button
        title={alreadyRecorded ? "已记录" : completionMutation.isPending ? "提交中" : "提交完成"}
        disabled={alreadyRecorded || completionMutation.isPending}
        onPress={() => completionMutation.mutate()}
      />
    </>
  );
}

const styles = StyleSheet.create({
  bar: { borderRadius: BAR_RADIUS, width: BAR_WIDTH },
  barCol: { alignItems: "center", gap: 6 },
  barRow: {
    alignItems: "flex-end",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xs
  },
  card: { borderRadius: radius.card, gap: 14, marginHorizontal: 20, padding: 18 },
  cardHeaderLeft: { alignItems: "center", flexDirection: "row", gap: 10 },
  cardHeaderRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  circleButton: {
    alignItems: "center",
    borderRadius: radius.pill,
    height: 42,
    justifyContent: "center",
    width: 42
  },
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginHorizontal: 20
  },
  heroCard: {
    alignItems: "center",
    borderRadius: radius.sheet, // the hero card uses the larger 32pt radius
    flexDirection: "row",
    gap: 20,
    marginHorizontal: 20,
    padding: 18
  },
  heroDivider: { alignSelf: "stretch", width: StyleSheet.hairlineWidth },
  heroMetricRow: {
    alignItems: "baseline",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10
  },
  heroMetrics: { flex: 1 },
  iconTile: {
    alignItems: "center",
    borderRadius: 10,
    height: 32,
    justifyContent: "center",
    width: 32
  },
  listCard: { borderRadius: radius.card, marginHorizontal: 20, paddingVertical: spacing.lg },
  listCardFooter: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs },
  listCardHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.lg
  },
  pageTitle: { fontSize: 30, letterSpacing: -0.5, lineHeight: 36, marginTop: 2 },
  rowDivider: { height: StyleSheet.hairlineWidth, marginHorizontal: spacing.lg }
});
```

- [ ] **Step 6: Run the focused tests, full suite, and typecheck**

Run: `npm test --workspace @hbm/mobile -- src/warmUi.test.ts src/trainingFlows.test.ts`

Expected: PASS. `trainingFlows.test.ts` still finds `completeTrainingTask`, `useMutation`, and `提交完成` in the rewritten screen.

Run: `npm test --workspace @hbm/mobile`

Run: `npx tsc -p apps/mobile/tsconfig.json --noEmit`

Expected: both exit 0.

- [ ] **Step 7: Verify on the simulator**

Run: `npm run ios --workspace @hbm/mobile`

Check: the in-page header shows the real date as `M月D日 · 周X`; the calendar button jumps to the Plan tab; the hero ring matches the recovery value; the sleep bars render newest-right with the dark latest bar (or the empty-state copy with no sleep data); the checklist cycles 待办/完成/跳过, the progress meta counts completions, 实际负荷 accepts a number, and 提交完成 still invalidates and toasts; the last card scrolls fully clear of the capsule.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/src/components/QuietHealth.tsx "apps/mobile/app/(app)/(tabs)/today/_layout.tsx" "apps/mobile/app/(app)/(tabs)/today/index.tsx" apps/mobile/src/warmUi.test.ts
git commit -m "feat(mobile): rebuild the today tab as warm cards"
```

---

### Task 5: Full verification and manual QA

Phase 1 is code-complete. Run every gate, then walk the app in both appearances.

**Files:**
- Modify: only files touched by fixes the verification surfaces (ideally none).

**Interfaces:**
- Consumes: everything from Tasks 1–4.

- [ ] **Step 1: Full mobile suite**

Run: `npm test --workspace @hbm/mobile`

Expected: exit 0 — 22 `warmUi.test.ts` contract tests, the `FloatingTabBar` tests, and every pre-existing suite green.

- [ ] **Step 2: Typecheck**

Run: `npx tsc -p apps/mobile/tsconfig.json --noEmit`

Expected: exit 0.

- [ ] **Step 3: Lint**

Run: `npm run lint --workspace @hbm/mobile`

Expected: exit 0. In particular no unused-import warnings in `QuietHealth.tsx` (the `MetricStrip` removal) or the rewritten tab layout.

- [ ] **Step 4: Repo-root suite**

Run: `npm test`

Expected: exit 0 — the backend and web suites are untouched by this plan.

- [ ] **Step 5: Manual QA pass**

Run: `npm run ios --workspace @hbm/mobile`

Walk the checklist:
- All five tabs switch through the capsule; the active glyph is `controlFill`, inactive is `labelSecondary`; the FAB jumps to 教练; the capsule and FAB cast the card shadow.
- Today: in-page header with the real date and weekday; calendar button opens Plan; hero ring matches recovery; sleep bars and checklist behave as in Task 4 Step 7; the page scrolls so the submit button clears the capsule on a small device.
- The other four tabs render the warm palette with iOS-era layouts (large titles, inset groups with the 28pt radius and shadow) — this mixed state is intentional for phase 1.
- Toggle dark mode (Features > Toggle Appearance) and re-walk all five tabs: backgrounds `#1A1917`, cards `#252421`, every label legible, shadows still subtle. The dark palette was derived during prototyping without a visual source — this pass is its acceptance check.
- Enable VoiceOver: the four tab buttons announce 今日/计划/数据/我的 as buttons, the FAB announces 快速记录, checklist rows announce their checkbox state, and the calendar button announces 查看本周计划.
- Set Dynamic Type to the largest accessibility size: metric rows wrap or grow without clipping, the ring centre stays centered, and no action is truncated.
- Enable Reduce Transparency: nothing changes (no blur remains). Enable Increase Contrast and confirm filled-button and FAB glyphs stay legible in both appearances.

- [ ] **Step 6: Commit any fixes**

If QA surfaced fixes, commit them:

```bash
git add -A apps/mobile
git commit -m "fix(mobile): address warm card phase 1 QA findings"
```

If the tree is clean, skip the commit — do not create an empty one.

---

## Self-Review

**Spec coverage.** Every spec bullet maps to a task. Palette table (including the new `orange` key and the `labelTertiary` 60% derivation `rgba(139,139,131,0.6)`), `radius.card` 28, `radius.sheet` 32, `radius.bubble` 20, new `radius.pill` 999, and `cardShadow(scheme)` → Task 1. `Button` pill + `controlFill`/`controlLabel` + the `0.65`/`0.45` → `opacity.pressed`/`opacity.disabled` fix + `marginHorizontal: 16` → Task 2. `CheckRow` completed = `tint`, border = `separator` → Task 2. `InsetGroup` shadow + automatic 28pt radius, `Row` with no API change (it picks up the palette through tokens) → Task 2. `Screen.bottomClearance` defaulting to the capsule footprint inside the tab navigator → Task 2. Floating capsule tab bar (white capsule, radius 999, shadow, `insets.bottom + 16`, 20pt margins, five tabs in order, icon-only, active `controlFill` / inactive `labelSecondary`, 60pt FAB overlapping the top edge by 20pt with a Plus in `controlLabel`, phase-1 action → Coach tab, icons unchanged, Reduce Transparency no-op, VoiceOver Chinese labels + 快速记录) → Task 3. Today tab (hidden native header, date overline + 今日 30pt/700 title, trailing circular surface button with calendar icon → Plan tab, manual safe-area top inset, horizontal hero card with 116pt/stroke-10 ring and three hairline-separated metric rows, weekly sleep bar card with moon tile + 平均 meta + newest bar in `controlFill`, checklist card with progress meta + hairline-separated `CheckRow`s + preserved 实际负荷 `TextField` + pill submit `Button`, 16pt card spacing, 20pt margins) → Task 4. `iosUi.test.ts` → `warmUi.test.ts` rename and rewrite → Tasks 1–4 (rewritten in Task 1, tab-bar test replaced in Task 3, Today test replaced in Task 4). Component tests keep passing with only the colour assertions updated — the token-tracking ones in Task 1 (`CheckRow` box `#237F3C`→`#22221F`, border `#C6C6C8`→`#D8D6CE`, `Row` destructive `#FF3B30`→`#C4534A`) and the restyle-driven one in Task 2 (`CheckRow` box `#22221F`→`#3D7A55`). Acceptance gates (`npm test --workspace @hbm/mobile`, `tsc`, lint, repo-root `npm test`) → every task plus Task 5.

**Placeholder scan.** Every code step carries the complete file content or the exact before/after block. The only edits expressed as replacements rather than full files are the three literal colour-string changes in `CheckRow.test.tsx`/`Row.test.tsx` (exact old and new strings given) and the two warmUi test swaps (the tests to delete are named in full, the replacements are given in full).

**Type consistency.** `cardShadow(scheme: "light" | "dark")` is defined in Task 1 and consumed in Tasks 2 (`InsetGroup`), 3 (`FloatingTabBar`), and 4 (Today, via the `ReturnType<typeof cardShadow>` prop type). `FLOATING_TAB_BAR_CLEARANCE` is defined in Task 2 (`tabBarMetrics.ts`, which exists before `Screen` imports it) and documents the layout Task 3 implements. `radius.pill` and `tokens.orange` are defined in Task 1 before any consumer. `BottomTabBarProps` comes from `@react-navigation/bottom-tabs`, already a direct dependency since the iOS plan's Task 3. `ReadinessRing`'s signature (`{ value, label? }`) is unchanged, so its only caller needs no adaptation beyond the new layout. `CheckStatus`/`CheckRow`/`TextField`/`Button` signatures are unchanged, which is why `trainingFlows.test.ts`, `coachLayout.test.ts`, `coachLifecycle.test.ts`, and the ChoiceGroup/TextField consumers need no changes. The `surfaceAlt` values (`#EFEEE9` light, `#33322E` dark) are a documented derivation — the spec table omits this key — chosen to mirror the iOS light/dark relationship to `bg`/`fill`; revisit if phase 2 needs a distinct tertiary surface.

## Risks

- **The custom tab bar must not break navigation state.** It is rendered through the `tabBar` render prop and dispatches the standard `tabPress` event before `navigate`, mirroring the React Navigation custom-tab-bar pattern; Task 3 Step 7 taps every tab in the simulator.
- **The capsule cannot be measured through `BottomTabBarHeightContext`.** It is absolutely positioned (the context reads 0), so `Screen` uses the explicit 110pt clearance constant. If the capsule metrics change later (padding, FAB size, offset), `tabBarMetrics.ts` must be updated in the same commit.
- **The centre tab slot is a spacer.** The FAB — not a tab button — owns Coach navigation, so when Coach is active there is no highlighted glyph in the capsule. Accepted for phase 1 (the FAB *is* the centre control); phase 2's real FAB action must revisit this.
- **Dark mode is an inversion of the reference with no visual source.** Task 5 Step 5 walks every screen in dark mode; expect to tune `shadowOpacity` or `surfaceAlt` there.
- **Hiding the native header on Today only** leaves the other four tabs with iOS large titles — intentional during the transition (spec non-goal); do not "fix" it.
- **iOS clips shadows on `overflow: "hidden"` views.** `InsetGroup` therefore splits shadow (outer) and clipping (inner); Today's bespoke cards never clip, so they keep the shadow on the card itself.
- **`radius.card` 10 → 28 applies globally immediately**, including the ChoiceGroup segmented track and every settings card. That global jump is the spec's accepted half-migrated state, but it is the most visually aggressive change for un-migrated tabs — covered by the Task 5 QA walk.
- **`expo-blur` becomes an unused dependency.** It stays installed (removal needs a native rebuild and gains nothing in phase 1); remove it when phase 2 does its own native rebuild.
