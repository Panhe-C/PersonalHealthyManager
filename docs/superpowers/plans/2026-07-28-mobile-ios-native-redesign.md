# Mobile iOS Native Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the custom "Quiet Health" editorial look on the Expo app with iOS native design language: system grouped colours and SF Pro type, inset grouped card lists including a training checklist card, native collapse-on-scroll large titles, and a translucent tab bar.

**Architecture:** Three layers, migrated bottom-up. (1) The theme layer gains explicit iOS palette values, accessible control foreground/background pairs, and iOS text-style tokens while keeping the old Quiet Health names as aliases, so ~250 existing `tokens.*` call sites keep compiling and every task can end green. (2) A new list primitive layer (`InsetGroup` / `Row` / `CheckRow`) replaces the hairline-and-`Card` mix. (3) Routing changes from one flat stack to a stack nested inside each tab, which is what unlocks native large titles and keeps the tab bar visible on pushed pages. The final task deletes the aliases and the retired primitives, and `tsc` proves no call site was missed.

**Tech Stack:** Expo SDK 53, Expo Router 5.1, React Native 0.79, TypeScript, `@react-navigation/bottom-tabs` 7.18, `@react-navigation/native-stack` 7.17, react-native-screens 4.11, `expo-blur`, lucide-react-native, react-native-svg, Vitest.

## Global Constraints

- Preserve every existing API query, mutation, conversation action, and auth action. This is a visual and navigational refactor only.
- Keep the app Chinese-first.
- Keep exactly five tabs in this order: 今日、计划、教练、数据、我的.
- Use explicit iOS palette values with separate accessible control pairs. Light: `bg #F2F2F7`, `surface #FFFFFF`, `label #000000`, `labelSecondary rgba(60,60,67,0.6)`, `separator rgba(60,60,67,0.29)`, `tint #248A3D`, `controlFill #237F3C`, `controlLabel #FFFFFF`, `red #FF3B30`, `destructiveFill #D70015`, `destructiveLabel #FFFFFF`. Dark: `bg #000000`, `surface #1C1C1E`, `label #FFFFFF`, `labelSecondary rgba(235,235,245,0.6)`, `separator rgba(84,84,88,0.6)`, `tint #30D158`, `controlFill #30D158`, `controlLabel #000000`, `red #FF453A`, `destructiveFill #FF6961`, `destructiveLabel #000000`. These are deterministic cross-platform snapshots rather than UIKit `PlatformColor` values; verify Increase Contrast manually.
- Use iOS text style metrics (fontSize/lineHeight): largeTitle 34/41, title1 28/34, title2 22/28, title3 20/25, headline 17/22, body 17/22, callout 16/21, subheadline 15/20, footnote 13/18, caption 12/16, caption2 11/13.
- No `fontFamily` overrides anywhere. The RN default on iOS is SF Pro.
- Keep `largeTitle`, `title1`, `title2`, and `title3` regular by default; only `headline` defaults to semibold. Business emphasis must pass `weight` explicitly.
- No gradients, no decorative shadows, no glassmorphism beyond the system blur materials used by the nav bar and tab bar.
- Row heights: 44pt minimum for single-line and 60pt minimum with a subtitle, and every header icon action has a 44pt hit target. Group cards use `borderRadius: 10` and `marginHorizontal: 16`.
- Separators are drawn by `InsetGroup`, never by rows, so the last row in a group never has one.
- Settings detail navigation uses absolute typed Expo Router paths under `/(app)/(tabs)/settings/`; do not use document-relative `./detail` paths.
- VoiceOver state, maximum Dynamic Type, Reduce Transparency, Increase Contrast, and keyboard avoidance are release acceptance criteria.
- Every task ends with `npx tsc -p apps/mobile/tsconfig.json --noEmit` passing and `npm test --workspace @hbm/mobile` green.

**Commands used throughout:**

- Focused test: `npm test --workspace @hbm/mobile -- <path>`
- Full mobile tests: `npm test --workspace @hbm/mobile`
- Typecheck: `npx tsc -p apps/mobile/tsconfig.json --noEmit`
- Lint: `npm run lint --workspace @hbm/mobile`

---

### Task 1: iOS colour and type tokens

Swap the palette and type scale to iOS values. Old token names survive as aliases pointing at the new values, so the app immediately renders in iOS colours without touching any screen yet.

**Files:**
- Modify: `apps/mobile/src/theme/tokens.ts`
- Modify: `apps/mobile/src/components/Text.tsx`
- Create: `apps/mobile/src/iosUi.test.ts`
- Delete: `apps/mobile/src/quietHealthUi.test.ts`

**Interfaces:**
- Produces: `lightTokens` / `darkTokens` with new keys `surface`, `surfaceAlt`, `label`, `labelSecondary`, `labelTertiary`, `separator`, `separatorOpaque`, `tint`, `tintFill`, `controlFill`, `controlLabel`, `fill`, `red`, `redFill`, `destructiveFill`, `destructiveLabel`, plus deprecated aliases `panel`, `panelSoft`, `ink`, `inkStrong`, `muted`, `line`, `lineStrong`, `sage`, `sageStrong`, `sageSoft`, `clay`, `claySoft`, `danger`, `dangerSoft`.
- Produces: `textStyles` keyed by `largeTitle | title1 | title2 | title3 | headline | body | callout | subheadline | footnote | caption | caption2 | metric` plus deprecated aliases `xs | sm | md | lg | xl | xxl | display | hero`.
- Produces: `radius` with `sm | card | md | sheet | bubble` plus deprecated `lg | xl`.
- Produces: `Text` accepting `size?: keyof typeof textStyles`, `weight?: "regular" | "medium" | "semibold" | "strong" | "bold"`, `color?: string`, `tabularNums?: boolean`.
- Consumes: nothing.

- [ ] **Step 1: Write the failing contract test**

Create `apps/mobile/src/iosUi.test.ts`:

```ts
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
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --workspace @hbm/mobile -- src/iosUi.test.ts`

Expected: FAIL. The first assertion fails on `bg: "#F2F2F7"` because tokens still say `bg: "#F6F4EE"`.

- [ ] **Step 3: Rewrite the tokens**

Replace the whole of `apps/mobile/src/theme/tokens.ts`:

```ts
import { useColorScheme } from "react-native";

// Explicit iOS palette snapshots. Key names follow UIKit so the mapping stays auditable:
// bg = systemGroupedBackground, surface = secondarySystemGroupedBackground,
// surfaceAlt = tertiarySystemGroupedBackground, fill = secondarySystemFill.
// `tint` is the accessible systemGreen for text and icons; `tintFill` preserves
// the bright systemGreen for non-text fills. Text-bearing filled controls use
// the explicit control/destructive foreground-background pairs below.
const lightBase = {
  bg: "#F2F2F7",
  surface: "#FFFFFF",
  surfaceAlt: "#F2F2F7",
  label: "#000000",
  labelSecondary: "rgba(60,60,67,0.6)",
  labelTertiary: "rgba(60,60,67,0.3)",
  separator: "rgba(60,60,67,0.29)",
  separatorOpaque: "#C6C6C8",
  tint: "#248A3D",
  tintFill: "#34C759",
  controlFill: "#237F3C",
  controlLabel: "#FFFFFF",
  fill: "rgba(120,120,128,0.12)",
  red: "#FF3B30",
  redFill: "rgba(255,59,48,0.12)",
  destructiveFill: "#D70015",
  destructiveLabel: "#FFFFFF"
} as const;

type BaseTokens = typeof lightBase;

const darkBase: BaseTokens = {
  bg: "#000000",
  surface: "#1C1C1E",
  surfaceAlt: "#2C2C2E",
  label: "#FFFFFF",
  labelSecondary: "rgba(235,235,245,0.6)",
  labelTertiary: "rgba(235,235,245,0.3)",
  separator: "rgba(84,84,88,0.6)",
  separatorOpaque: "#38383A",
  tint: "#30D158",
  tintFill: "#30D158",
  controlFill: "#30D158",
  controlLabel: "#000000",
  fill: "rgba(120,120,128,0.36)",
  red: "#FF453A",
  redFill: "rgba(255,69,58,0.18)",
  destructiveFill: "#FF6961",
  destructiveLabel: "#000000"
};

/**
 * Deprecated Quiet Health names, mapped onto the iOS palette so screens can
 * migrate one at a time. Deleted in Task 11 once no call sites remain.
 */
function withLegacyAliases(base: BaseTokens) {
  return {
    ...base,
    panel: base.surface,
    panelSoft: base.surfaceAlt,
    ink: base.label,
    inkStrong: base.label,
    muted: base.labelSecondary,
    line: base.separator,
    lineStrong: base.separatorOpaque,
    sage: base.tint,
    sageStrong: base.tint,
    sageSoft: base.fill,
    clay: base.tint,
    claySoft: base.fill,
    danger: base.red,
    dangerSoft: base.redFill
  };
}

export const lightTokens = withLegacyAliases(lightBase);
export const darkTokens = withLegacyAliases(darkBase);

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
  card: 10,
  md: 12,
  sheet: 16,
  bubble: 20,
  // Deprecated Quiet Health radii, removed in Task 11.
  lg: 16,
  xl: 22
} as const;

export const opacity = {
  pressed: 0.72,
  disabled: 0.5
} as const;

// iOS text styles at the default Dynamic Type size.
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
  metric: { fontSize: 40, lineHeight: 44 },
  // Deprecated Quiet Health scale, mapped to the nearest iOS style. Removed in
  // Task 11 once every call site uses a semantic name.
  xs: { fontSize: 12, lineHeight: 16 },
  sm: { fontSize: 15, lineHeight: 20 },
  md: { fontSize: 17, lineHeight: 22 },
  lg: { fontSize: 20, lineHeight: 25 },
  xl: { fontSize: 22, lineHeight: 28 },
  xxl: { fontSize: 28, lineHeight: 34 },
  display: { fontSize: 34, lineHeight: 41 },
  hero: { fontSize: 34, lineHeight: 41 }
} as const;

export type ThemeTokens = { [K in keyof ReturnType<typeof withLegacyAliases>]: string };

export function useTheme(): { tokens: ThemeTokens; isDark: boolean } {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  return { tokens: isDark ? darkTokens : lightTokens, isDark };
}
```

- [ ] **Step 4: Rewrite Text to use the iOS styles**

Replace the whole of `apps/mobile/src/components/Text.tsx`:

```tsx
import { StyleSheet, Text as RNText, type TextProps } from "react-native";
import { textStyles, useTheme } from "../theme/tokens";

const weights = {
  regular: "400",
  medium: "500",
  semibold: "600",
  strong: "700",
  bold: "700"
} as const;

// UIKit preferred text styles are regular by default except headline.
// Callers opt into stronger emphasis explicitly.
const semiboldSizes = new Set(["headline"]);

export function Text({
  style,
  size = "body",
  weight,
  color,
  tabularNums = false,
  ...props
}: TextProps & {
  size?: keyof typeof textStyles;
  weight?: keyof typeof weights;
  color?: string;
  tabularNums?: boolean;
}) {
  const { tokens } = useTheme();
  const fallbackWeight = semiboldSizes.has(size) ? "semibold" : "regular";

  return (
    <RNText
      style={[
        textStyles[size],
        { color: color ?? tokens.label, fontWeight: weights[weight ?? fallbackWeight] },
        tabularNums && styles.tabular,
        style
      ]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  tabular: { fontVariant: ["tabular-nums"] }
});
```

- [ ] **Step 5: Delete the superseded Quiet Health contract test**

`apps/mobile/src/quietHealthUi.test.ts` asserts the beige palette, the sage header tint, a card-free settings composition, and file paths that Task 4 moves. It is fully superseded by `src/iosUi.test.ts`.

```bash
rm apps/mobile/src/quietHealthUi.test.ts
```

- [ ] **Step 6: Run the focused test to verify it passes**

Run: `npm test --workspace @hbm/mobile -- src/iosUi.test.ts`

Expected: PASS, 4 tests.

- [ ] **Step 7: Run the full suite and typecheck**

Run: `npm test --workspace @hbm/mobile`

Run: `npx tsc -p apps/mobile/tsconfig.json --noEmit`

Expected: both exit 0. The aliases keep every screen compiling; the app now renders iOS colours with the old layout.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/src/theme/tokens.ts apps/mobile/src/components/Text.tsx apps/mobile/src/iosUi.test.ts
git rm apps/mobile/src/quietHealthUi.test.ts
git commit -m "feat(mobile): adopt iOS semantic colour and text style tokens"
```

---

### Task 2: Inset grouped list primitives

Build the iOS grouped-card list layer: the card container that owns separators, the standard list row, and the checklist row.

**Files:**
- Create: `apps/mobile/src/components/InsetGroup.tsx`
- Create: `apps/mobile/src/components/InsetGroup.test.tsx`
- Create: `apps/mobile/src/components/Row.tsx`
- Create: `apps/mobile/src/components/Row.test.tsx`
- Create: `apps/mobile/src/components/CheckRow.tsx`
- Create: `apps/mobile/src/components/CheckRow.test.tsx`

**Interfaces:**
- Consumes: `radius`, `spacing`, `useTheme` from Task 1; `Text` from Task 1.
- Produces: `InsetGroup({ header?: string; footer?: string; insetSeparators?: boolean; children: ReactNode })` and the constant `SEPARATOR_INSET = 52`.
- Produces: `Row({ icon?: ReactNode; title: string; subtitle?: string; value?: string; onPress?: () => void; destructive?: boolean; trailing?: ReactNode; disabled?: boolean })`.
- Produces: `CheckRow({ label: string; status: CheckStatus; onPress?: () => void; disabled?: boolean })` and `type CheckStatus = "pending" | "completed" | "skipped"`.

- [ ] **Step 1: Write the failing InsetGroup test**

Create `apps/mobile/src/components/InsetGroup.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
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
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test --workspace @hbm/mobile -- src/components/InsetGroup.test.tsx`

Expected: FAIL with "Failed to resolve import ./InsetGroup".

- [ ] **Step 3: Implement InsetGroup**

Create `apps/mobile/src/components/InsetGroup.tsx`:

```tsx
import { Children, isValidElement, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { radius, spacing, useTheme } from "../theme/tokens";
import { Text } from "./Text";

/** Row padding (16) + icon slot (28) + gap (8), so separators clear the icon. */
export const SEPARATOR_INSET = 52;

/**
 * iOS inset grouped list section: a rounded surface card with hairline
 * separators between its rows. The separators live here rather than on the rows
 * so the last row never draws one, which is what UITableView insetGrouped does.
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
  const { tokens } = useTheme();
  const rows = Children.toArray(children).filter(isValidElement);

  return (
    <View style={styles.group}>
      {header ? (
        <Text size="footnote" color={tokens.labelSecondary} style={styles.header}>{header}</Text>
      ) : null}

      <View style={[styles.card, { backgroundColor: tokens.surface }]}>
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

      {footer ? (
        <Text size="footnote" color={tokens.labelSecondary} style={styles.footer}>{footer}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, overflow: "hidden" },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs },
  group: { marginHorizontal: spacing.lg },
  header: { paddingBottom: spacing.xs, paddingHorizontal: spacing.lg },
  separator: { height: StyleSheet.hairlineWidth }
});
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test --workspace @hbm/mobile -- src/components/InsetGroup.test.tsx`

Expected: PASS, 4 tests.

- [ ] **Step 5: Write the failing Row test**

Create `apps/mobile/src/components/Row.test.tsx`:

```tsx
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
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npm test --workspace @hbm/mobile -- src/components/Row.test.tsx`

Expected: FAIL with "Failed to resolve import ./Row".

- [ ] **Step 7: Implement Row**

Create `apps/mobile/src/components/Row.tsx`:

```tsx
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { spacing, useTheme } from "../theme/tokens";
import { Text } from "./Text";

/**
 * iOS list row, meant to sit inside an InsetGroup. Presses tint the whole row
 * with the system fill colour rather than fading it, which is what UIKit does
 * for selection. Separators are the group's job, not the row's.
 */
export function Row({
  icon,
  title,
  subtitle,
  value,
  onPress,
  destructive = false,
  trailing,
  disabled = false
}: {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
  trailing?: ReactNode;
  disabled?: boolean;
}) {
  const { tokens } = useTheme();
  const body = (
    <>
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <View style={styles.copy}>
        <Text size="body" color={destructive ? tokens.red : tokens.label}>{title}</Text>
        {subtitle ? <Text size="footnote" color={tokens.labelSecondary}>{subtitle}</Text> : null}
      </View>
      {value ? (
        <Text size="body" color={tokens.labelSecondary} numberOfLines={1}>{value}</Text>
      ) : null}
      {trailing}
      {onPress && !trailing ? <ChevronRight color={tokens.labelTertiary} size={17} strokeWidth={2.2} /> : null}
    </>
  );

  if (!onPress) {
    return <View style={[styles.row, subtitle ? styles.rowTall : null]}>{body}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        subtitle ? styles.rowTall : null,
        pressed ? { backgroundColor: tokens.fill } : null
      ]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  copy: { flex: 1, gap: 1 },
  icon: { alignItems: "center", justifyContent: "center", width: 28 },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm
  },
  rowTall: { minHeight: 60 }
});
```

- [ ] **Step 8: Run it to verify it passes**

Run: `npm test --workspace @hbm/mobile -- src/components/Row.test.tsx`

Expected: PASS, 5 tests.

- [ ] **Step 9: Write the failing CheckRow test**

Create `apps/mobile/src/components/CheckRow.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  Pressable: "Pressable",
  StyleSheet: { create: (styles: unknown) => styles },
  useColorScheme: () => "light",
  View: "View"
}));

vi.mock("lucide-react-native", () => ({ Check: "Check" }));
vi.mock("./Text", () => ({ Text: "Text" }));

import { CheckRow } from "./CheckRow";

type Node = { type?: unknown; props?: { style?: unknown; children?: unknown } };

function types(node: unknown): unknown[] {
  if (Array.isArray(node)) return node.flatMap(types);
  if (!node || typeof node !== "object") return [];
  const element = node as Node;
  return [element.type, ...types(element.props?.children)];
}

function flatten(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) return Object.assign({}, ...style.map(flatten));
  return (style ?? {}) as Record<string, unknown>;
}

describe("CheckRow", () => {
  it("fills the box with the system green and shows a checkmark when completed", () => {
    const element = CheckRow({ label: "热身 10 分钟", status: "completed" });
    const [box] = (element.props?.children as Node[]) ?? [];

    expect(types(element)).toContain("Check");
    expect(flatten(box.props?.style).backgroundColor).toBe("#237F3C");
  });

  it("shows an empty outlined box when pending", () => {
    const element = CheckRow({ label: "主课 30 分钟", status: "pending" });
    const [box] = (element.props?.children as Node[]) ?? [];

    expect(types(element)).not.toContain("Check");
    expect(flatten(box.props?.style).backgroundColor).toBeUndefined();
    expect(flatten(box.props?.style).borderColor).toBe("#C6C6C8");
  });

  it("strikes through a skipped label", () => {
    const element = CheckRow({ label: "放松 5 分钟", status: "skipped" });
    const label = (element.props?.children as Node[])[1];

    expect(flatten(label.props?.style).textDecorationLine).toBe("line-through");
  });

  it("reports checkbox state to assistive technology", () => {
    const element = CheckRow({ label: "拉伸", status: "completed", onPress: () => undefined });

    expect(element.props?.accessibilityRole).toBe("checkbox");
    expect(element.props?.accessibilityState).toEqual({ checked: true, disabled: false });
  });

  it("reports skipped as a mixed checkbox state", () => {
    const element = CheckRow({ label: "放松", status: "skipped", onPress: () => undefined });

    expect(element.props?.accessibilityState).toEqual({ checked: "mixed", disabled: false });
    expect(element.props?.accessibilityValue).toEqual({ text: "已跳过" });
  });
});
```

- [ ] **Step 10: Run it to verify it fails**

Run: `npm test --workspace @hbm/mobile -- src/components/CheckRow.test.tsx`

Expected: FAIL with "Failed to resolve import ./CheckRow".

- [ ] **Step 11: Implement CheckRow**

Create `apps/mobile/src/components/CheckRow.tsx`:

```tsx
import { Pressable, StyleSheet, View } from "react-native";
import { Check } from "lucide-react-native";
import { spacing, useTheme } from "../theme/tokens";
import { Text } from "./Text";

export type CheckStatus = "pending" | "completed" | "skipped";

/**
 * Checklist row for training tasks. Tapping cycles the status upstream; this
 * component only renders the three states.
 */
export function CheckRow({
  label,
  status,
  onPress,
  disabled = false
}: {
  label: string;
  status: CheckStatus;
  onPress?: () => void;
  disabled?: boolean;
}) {
  const { tokens } = useTheme();
  const completed = status === "completed";
  const skipped = status === "skipped";
  const isDisabled = disabled || !onPress;

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: skipped ? "mixed" : completed, disabled: isDisabled }}
      accessibilityValue={skipped ? { text: "已跳过" } : undefined}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed ? { backgroundColor: tokens.fill } : null]}
    >
      <View
        style={[
          styles.box,
          completed
            ? { backgroundColor: tokens.controlFill, borderColor: tokens.controlFill }
            : { borderColor: tokens.separatorOpaque }
        ]}
      >
        {completed ? <Check color={tokens.controlLabel} size={15} strokeWidth={3} /> : null}
        {skipped ? <View style={[styles.dash, { backgroundColor: tokens.labelTertiary }]} /> : null}
      </View>

      <Text
        size="body"
        color={skipped ? tokens.labelSecondary : tokens.label}
        style={[styles.label, skipped ? styles.struck : null]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: "center",
    borderRadius: 11,
    borderWidth: 1.5,
    height: 22,
    justifyContent: "center",
    width: 22
  },
  dash: { height: 1.5, width: 10 },
  label: { flex: 1 },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm
  },
  struck: { textDecorationLine: "line-through" }
});
```

- [ ] **Step 12: Run the full suite and typecheck**

Run: `npm test --workspace @hbm/mobile -- src/components`

Expected: PASS, 14 new tests plus the existing Card test.

Run: `npm test --workspace @hbm/mobile`

Run: `npx tsc -p apps/mobile/tsconfig.json --noEmit`

Expected: both exit 0.

- [ ] **Step 13: Commit**

```bash
git add apps/mobile/src/components/InsetGroup.tsx apps/mobile/src/components/InsetGroup.test.tsx apps/mobile/src/components/Row.tsx apps/mobile/src/components/Row.test.tsx apps/mobile/src/components/CheckRow.tsx apps/mobile/src/components/CheckRow.test.tsx
git commit -m "feat(mobile): add iOS inset grouped list primitives"
```

---

### Task 3: Rebuild Screen, Button, TextField, and the segmented control

Make the scroll container header-aware and tab-bar-aware, and restyle the three form primitives to iOS.

**Files:**
- Modify: `apps/mobile/src/components/Screen.tsx`
- Modify: `apps/mobile/src/components/Button.tsx`
- Modify: `apps/mobile/src/components/TextField.tsx`
- Modify: `apps/mobile/src/components/ChoiceGroup.tsx`
- Modify: `apps/mobile/package.json`
- Modify: `apps/mobile/src/iosUi.test.ts`

**Interfaces:**
- Consumes: tokens from Task 1.
- Produces: `Screen` with no horizontal padding (groups own their 16pt margin) and a bottom pad equal to the tab bar height.
- Produces: `Button({ title, onPress, variant?: "filled" | "tinted" | "plain" | "destructive", disabled? })`. `primary`, `ghost`, and `danger` stay accepted as deprecated aliases of `filled`, `plain`, and `destructive` so existing call sites keep compiling.
- Produces: `ChoiceGroup` unchanged in signature, restyled as an iOS segmented control.

- [ ] **Step 1: Declare the navigation dependency**

`Screen` needs `BottomTabBarHeightContext`, and `headerOptions.ts` imports the native-stack option type directly. Both packages currently resolve only through Expo Router's hoisted transitive install. Declare both direct dependencies in `apps/mobile/package.json`, keeping alphabetical order:

```json
"@react-navigation/bottom-tabs": "^7.18.3",
"@react-navigation/native-stack": "^7.17.6",
```

Run: `npm install`

Expected: lockfile updates, no version change for the already-hoisted package.

- [ ] **Step 2: Add the failing assertions for the new primitives**

Append to the `describe` block in `apps/mobile/src/iosUi.test.ts`:

```ts
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
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npm test --workspace @hbm/mobile -- src/iosUi.test.ts`

Expected: FAIL. `Screen.tsx` still contains `SafeAreaView` and `paddingHorizontal`.

- [ ] **Step 4: Rewrite Screen**

Replace the whole of `apps/mobile/src/components/Screen.tsx`:

```tsx
import { useContext } from "react";
import { ScrollView, StyleSheet, type ScrollViewProps } from "react-native";
import { BottomTabBarHeightContext } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing, useTheme } from "../theme/tokens";

/**
 * Scroll container for every screen. The native stack header owns the top inset
 * — `contentInsetAdjustmentBehavior="automatic"` is what lets iOS apply it and
 * drives the large-title collapse — so this adds no SafeAreaView of its own.
 * The translucent tab bar is cleared with an explicit bottom pad; the auth
 * screens render outside the tab navigator, hence the safe-area fallback.
 * No horizontal padding: InsetGroup carries the 16pt inset itself.
 */
export function Screen({ contentContainerStyle, children, ...props }: ScrollViewProps) {
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
        { paddingBottom: (tabBarHeight ?? insets.bottom) + spacing.xl },
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

- [ ] **Step 5: Rewrite Button**

Replace the whole of `apps/mobile/src/components/Button.tsx`:

```tsx
import { Pressable, StyleSheet, type PressableProps } from "react-native";
import { Text } from "./Text";
import { opacity, radius, spacing, useTheme } from "../theme/tokens";

type Variant = "filled" | "tinted" | "plain" | "destructive" | "primary" | "ghost" | "danger";

// Deprecated Quiet Health variant names, removed in Task 11.
const aliases: Record<Variant, "filled" | "tinted" | "plain" | "destructive"> = {
  filled: "filled",
  tinted: "tinted",
  plain: "plain",
  destructive: "destructive",
  primary: "filled",
  ghost: "plain",
  danger: "destructive"
};

export function Button({
  title,
  onPress,
  variant = "filled",
  disabled,
  ...props
}: PressableProps & { title: string; variant?: Variant }) {
  const { tokens } = useTheme();
  const resolved = aliases[variant];
  const backgroundColor =
    resolved === "filled" ? tokens.controlFill
    : resolved === "destructive" ? tokens.destructiveFill
    : resolved === "tinted" ? tokens.fill
    : "transparent";
  const labelColor =
    resolved === "filled" ? tokens.controlLabel
    : resolved === "destructive" ? tokens.destructiveLabel
    : tokens.tint;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor },
        pressed ? styles.pressed : null,
        disabled ? styles.disabled : null
      ]}
      {...props}
    >
      <Text size="body" weight="semibold" color={labelColor} style={styles.label}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    justifyContent: "center",
    marginHorizontal: spacing.lg,
    minHeight: 50,
    paddingHorizontal: spacing.lg
  },
  disabled: { opacity: opacity.disabled },
  label: { textAlign: "center" },
  pressed: { opacity: opacity.pressed }
});
```

- [ ] **Step 6: Rewrite TextField as a grouped-row input**

Replace the whole of `apps/mobile/src/components/TextField.tsx`:

```tsx
import { StyleSheet, TextInput, useWindowDimensions, View } from "react-native";
import { Text } from "./Text";
import { spacing, useTheme } from "../theme/tokens";

/**
 * Labelled input shaped like an iOS grouped form row: the label sits on the
 * left, the field fills the rest of the row, and errors/hints hang below. Meant
 * to be a direct child of InsetGroup, which draws the separators.
 */
export function TextField({
  label,
  value,
  onChange,
  placeholder,
  secure,
  hint,
  error,
  keyboardType = "default",
  autoCapitalize = "none",
  editable = true
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  secure?: boolean;
  hint?: string;
  error?: string;
  keyboardType?: "default" | "email-address" | "number-pad" | "decimal-pad";
  autoCapitalize?: "none" | "sentences";
  editable?: boolean;
}) {
  const { tokens } = useTheme();
  const { fontScale } = useWindowDimensions();
  const stacked = fontScale >= 1.4;

  return (
    <View style={styles.field}>
      <View style={[styles.row, stacked ? styles.rowStacked : null]}>
        <Text size="body" color={tokens.label} style={[styles.label, stacked ? styles.labelStacked : null]}>{label}</Text>
        <TextInput
          accessibilityLabel={label}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          editable={editable}
          keyboardType={keyboardType}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={tokens.labelTertiary}
          secureTextEntry={secure}
          value={value}
          style={[
            styles.input,
            { color: editable ? tokens.label : tokens.labelSecondary, textAlign: stacked ? "left" : "right" }
          ]}
        />
      </View>
      {error ? <Text size="footnote" color={tokens.red} style={styles.note}>{error}</Text> : null}
      {!error && hint ? <Text size="footnote" color={tokens.labelSecondary} style={styles.note}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { paddingVertical: spacing.xs },
  input: { flex: 1, fontSize: 17, minHeight: 44 },
  label: { width: 96 },
  labelStacked: { width: "100%" },
  note: { paddingBottom: spacing.sm, paddingHorizontal: spacing.lg },
  row: { alignItems: "center", flexDirection: "row", gap: spacing.md, paddingHorizontal: spacing.lg },
  rowStacked: { alignItems: "stretch", flexDirection: "column", gap: 0 }
});
```

- [ ] **Step 7: Restyle ChoiceGroup as an iOS segmented control**

Replace the `return` body and `styles` of `apps/mobile/src/components/ChoiceGroup.tsx`, keeping the exported signature and generics exactly as they are:

```tsx
  return (
    <View style={styles.group}>
      {label ? <Text size="footnote" color={tokens.labelSecondary}>{label}</Text> : null}
      <View style={[styles.track, { backgroundColor: tokens.fill }]}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected }}
              disabled={disabled}
              key={option.value}
              onPress={() => onChange(option.value)}
              style={[
                styles.segment,
                selected ? { backgroundColor: tokens.surface } : null,
                disabled ? { opacity: opacity.disabled } : null
              ]}
            >
              <Text
                size="subheadline"
                weight={selected ? "semibold" : "regular"}
                color={tokens.label}
                style={styles.segmentLabel}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  segment: { borderRadius: radius.sm, flex: 1, justifyContent: "center", minHeight: 32, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  segmentLabel: { textAlign: "center" },
  track: { borderRadius: radius.card, flexDirection: "row", gap: 2, padding: 2 }
});
```

- [ ] **Step 8: Run the focused test, full suite, and typecheck**

Run: `npm test --workspace @hbm/mobile -- src/iosUi.test.ts`

Expected: PASS, 7 tests.

Run: `npm test --workspace @hbm/mobile`

Run: `npx tsc -p apps/mobile/tsconfig.json --noEmit`

Expected: both exit 0.

- [ ] **Step 9: Commit**

```bash
git add apps/mobile/package.json package-lock.json apps/mobile/src/components/Screen.tsx apps/mobile/src/components/Button.tsx apps/mobile/src/components/TextField.tsx apps/mobile/src/components/ChoiceGroup.tsx apps/mobile/src/iosUi.test.ts
git commit -m "feat(mobile): rebuild screen container and form controls on iOS metrics"
```

---

### Task 4: Nest a stack in every tab for native large titles

This is the structural change that reclaims the top chrome. Today's flat stack keeps the eight detail pages as siblings of `(tabs)`, so pushing one covers the tab bar, and the tab screens have no native header at all. After this task each tab owns a native stack with `headerLargeTitleEnabled`, and the detail pages live inside the settings tab.

**Files:**
- Create: `apps/mobile/src/navigation/headerOptions.ts`
- Create: `apps/mobile/app/(app)/(tabs)/today/_layout.tsx`
- Create: `apps/mobile/app/(app)/(tabs)/plan/_layout.tsx`
- Create: `apps/mobile/app/(app)/(tabs)/coach/_layout.tsx`
- Create: `apps/mobile/app/(app)/(tabs)/insights/_layout.tsx`
- Create: `apps/mobile/app/(app)/(tabs)/settings/_layout.tsx`
- Rename: `apps/mobile/app/(app)/(tabs)/{today,plan,coach,insights,settings}.tsx` to `{today,plan,coach,insights,settings}/index.tsx`
- Rename: the eight `apps/mobile/app/(app)/<detail>.tsx` files into `apps/mobile/app/(app)/(tabs)/settings/`
- Modify: `apps/mobile/app/(app)/_layout.tsx`
- Modify: `apps/mobile/src/iosUi.test.ts`, `apps/mobile/src/trainingFlows.test.ts`, `apps/mobile/src/coachLifecycle.test.ts`, `apps/mobile/src/coachLayout.test.ts`

**Interfaces:**
- Produces: `useNativeHeaderOptions(): NativeStackNavigationOptions`, shared by all five tab stacks.
- Produces: route paths `/(app)/(tabs)/<tab>` (unchanged, because a directory with `index.tsx` resolves identically — the notification deep links in `app/_layout.tsx` keep working) and `/(app)/(tabs)/settings/<detail>`.
- Consumes: tokens from Task 1.

- [ ] **Step 1: Add the failing routing assertions**

Append to the `describe` block in `apps/mobile/src/iosUi.test.ts`, and add these constants next to the existing `read` helper at the top of the file:

```ts
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
```

```ts
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test --workspace @hbm/mobile -- src/iosUi.test.ts`

Expected: FAIL with ENOENT on `../app/(app)/(tabs)/today/_layout.tsx`.

- [ ] **Step 3: Create the shared header options**

Create `apps/mobile/src/navigation/headerOptions.ts`:

```ts
import type { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { useTheme } from "../theme/tokens";

/**
 * Shared native-stack header options for the five tab stacks.
 * `headerLargeTitleEnabled` is what gives iOS collapse-on-scroll: the title starts at
 * 34pt and shrinks into the 44pt bar as the user scrolls. `headerTransparent`
 * plus a blur effect lets content show through the bar once collapsed, which
 * requires the screen's ScrollView to set
 * `contentInsetAdjustmentBehavior="automatic"` (see components/Screen.tsx).
 */
export function useNativeHeaderOptions(): NativeStackNavigationOptions {
  const { tokens, isDark } = useTheme();

  return {
    headerLargeTitleEnabled: true,
    headerLargeTitleShadowVisible: false,
    headerLargeTitleStyle: { color: tokens.label },
    headerTransparent: true,
    headerBlurEffect: isDark ? "systemChromeMaterialDark" : "systemChromeMaterialLight",
    headerShadowVisible: false,
    headerTintColor: tokens.tint,
    headerTitleStyle: { color: tokens.label },
    contentStyle: { backgroundColor: tokens.bg }
  };
}
```

- [ ] **Step 4: Move the five tab screens into directories**

```bash
cd apps/mobile/app/\(app\)/\(tabs\)
for tab in today plan coach insights settings; do mkdir -p "$tab" && git mv "$tab.tsx" "$tab/index.tsx"; done
cd -
```

- [ ] **Step 5: Fix the relative imports in the moved screens**

Every moved screen gained one directory level, so `../../../src/...` becomes `../../../../src/...`.

```bash
cd apps/mobile/app/\(app\)/\(tabs\)
sed -i '' 's|"\.\./\.\./\.\./src/|"../../../../src/|g' today/index.tsx plan/index.tsx coach/index.tsx insights/index.tsx settings/index.tsx
cd -
```

- [ ] **Step 6: Write the four tab layouts that only host an index**

Create `apps/mobile/app/(app)/(tabs)/today/_layout.tsx`:

```tsx
import { Stack } from "expo-router";
import { useNativeHeaderOptions } from "../../../../src/navigation/headerOptions";

export default function TodayLayout() {
  const screenOptions = useNativeHeaderOptions();

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" options={{ title: "今日" }} />
    </Stack>
  );
}
```

Create `apps/mobile/app/(app)/(tabs)/plan/_layout.tsx` with the same body, renaming the component to `PlanLayout` and the title to `本周计划`.

Create `apps/mobile/app/(app)/(tabs)/insights/_layout.tsx` with the same body, renaming the component to `InsightsLayout` and the title to `数据`.

Create `apps/mobile/app/(app)/(tabs)/coach/_layout.tsx`. Chat screens use an inline title on iOS, not a large one, and Task 10 moves the coach toolbar into this header:

```tsx
import { Stack } from "expo-router";
import { useNativeHeaderOptions } from "../../../../src/navigation/headerOptions";

export default function CoachLayout() {
  const screenOptions = useNativeHeaderOptions();

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" options={{ title: "教练", headerLargeTitleEnabled: false }} />
    </Stack>
  );
}
```

- [ ] **Step 7: Move the eight detail pages into the settings tab**

```bash
cd apps/mobile/app/\(app\)
for screen in profile-settings account-security healthkit-settings model-settings connection-settings notification-settings goal-settings data-export; do git mv "$screen.tsx" "(tabs)/settings/$screen.tsx"; done
cd \(tabs\)/settings
sed -i '' 's|"\.\./\.\./src/|"../../../../src/|g' profile-settings.tsx account-security.tsx healthkit-settings.tsx model-settings.tsx connection-settings.tsx notification-settings.tsx goal-settings.tsx data-export.tsx
cd -
```

- [ ] **Step 8: Write the settings stack**

Create `apps/mobile/app/(app)/(tabs)/settings/_layout.tsx`:

```tsx
import { Stack } from "expo-router";
import { useNativeHeaderOptions } from "../../../../src/navigation/headerOptions";

// Pushed pages use an inline title, matching iOS Settings: only the root of a
// tab gets a large title.
const detailScreens = [
  { name: "profile-settings", title: "个人资料" },
  { name: "account-security", title: "账户安全" },
  { name: "healthkit-settings", title: "Apple 健康" },
  { name: "model-settings", title: "模型运行时" },
  { name: "connection-settings", title: "连接配置" },
  { name: "notification-settings", title: "通知与提醒" },
  { name: "goal-settings", title: "管理目标" },
  { name: "data-export", title: "导出数据" }
];

export default function SettingsLayout() {
  const screenOptions = useNativeHeaderOptions();

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" options={{ title: "我的" }} />
      {detailScreens.map((screen) => (
        <Stack.Screen
          key={screen.name}
          name={screen.name}
          options={{ title: screen.title, headerLargeTitleEnabled: false }}
        />
      ))}
    </Stack>
  );
}
```

- [ ] **Step 9: Reduce the app layout to an auth guard**

Replace the whole of `apps/mobile/app/(app)/_layout.tsx`. The detail screens and header theming now live in the settings stack:

```tsx
import { Redirect, Stack } from "expo-router";
import { useAuth } from "../../src/auth/AuthContext";
import { useTheme } from "../../src/theme/tokens";

export default function AppLayout() {
  const { status } = useAuth();
  const { tokens } = useTheme();
  if (status !== "authed") return <Redirect href="/(auth)/login" />;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: tokens.bg } }}>
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
```

- [ ] **Step 10: Repoint the settings navigation targets**

In `apps/mobile/app/(app)/(tabs)/settings/index.tsx`, replace the twelve document-relative calls with absolute typed routes. Expo Router resolves `./detail` relative to the current document by default, not the directory, so `router.push("./profile-settings")` is not acceptable here.

```bash
perl -0pi -e 's|router\.push\\("\\.\\./([a-z-]+)"\\)|router.push("/(app)/(tabs)/settings/$1")|g' apps/mobile/app/\(app\)/\(tabs\)/settings/index.tsx
```

Verify twelve replacements: `rg -c 'router.push\\("/\\(app\\)/\\(tabs\\)/settings/' apps/mobile/app/\(app\)/\(tabs\)/settings/index.tsx` prints `12`, and `rg 'router.push\\("\\./' ...` prints nothing.

- [ ] **Step 11: Remove the PageHeader calls from the five tab screens**

Native titles now render these. In each `apps/mobile/app/(app)/(tabs)/<tab>/index.tsx`, delete the `PageHeader` element and its import. Two need their action preserved:

In `plan/index.tsx`, delete the whole `<PageHeader ... />` element and instead register the generate action in the native header. Add these imports:

```tsx
import { useNavigation } from "expo-router";
import { useEffect } from "react";
```

and inside `PlanTab`, after `generateMutation` is declared:

```tsx
  const navigation = useNavigation();

  // The week-generation action belongs in the native header, which is the iOS
  // home for a screen-level action.
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="生成或调整本周计划"
          hitSlop={11}
          onPress={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
        >
          <Text size="body" color={tokens.tint}>
            {generateMutation.isPending ? "生成中" : data ? "调整" : "生成"}
          </Text>
        </Pressable>
      )
    });
  }, [data, generateMutation, navigation, tokens.tint]);
```

In `today/index.tsx`, the header carried the date subtitle. Delete the `PageHeader` and keep the date by passing it to the focus block, which Task 6 rebuilds; for now render it as the first child:

```tsx
      <Text size="footnote" color={tokens.labelSecondary} style={{ paddingHorizontal: spacing.lg }}>
        {data ? formatDateLabel(data.date) : "正在读取今日状态"}
      </Text>
```

In `coach/index.tsx` leave the custom header alone for now — Task 10 replaces it.

- [ ] **Step 12: Repoint the four tests that hardcode screen paths**

```bash
cd apps/mobile/src
sed -i '' 's|(tabs)/today.tsx|(tabs)/today/index.tsx|g; s|(tabs)/plan.tsx|(tabs)/plan/index.tsx|g; s|(tabs)/coach.tsx|(tabs)/coach/index.tsx|g' trainingFlows.test.ts coachLifecycle.test.ts coachLayout.test.ts
cd -
```

`coachLayout.test.ts` asserts `not.toContain('<PageHeader title="教练"')`, which still holds. Its other assertions target styles Task 10 changes and must keep passing until then.

- [ ] **Step 13: Run the full suite and typecheck**

Run: `npm test --workspace @hbm/mobile`

Run: `npx tsc -p apps/mobile/tsconfig.json --noEmit`

Expected: both exit 0.

- [ ] **Step 14: Verify on the simulator**

Run: `npm run ios --workspace @hbm/mobile`

Check: each tab shows a 34pt title that shrinks into the bar as you scroll; tapping a settings row pushes a page with an inline title **and the tab bar still visible**; the back button is green.

Also tap every settings destination once. Confirm none resolves to a root-level 404 or escapes the settings stack.

- [ ] **Step 15: Commit**

```bash
git add -A apps/mobile/app apps/mobile/src/navigation apps/mobile/src/iosUi.test.ts apps/mobile/src/trainingFlows.test.ts apps/mobile/src/coachLifecycle.test.ts apps/mobile/src/coachLayout.test.ts
git commit -m "refactor(mobile): nest a native stack per tab for collapsing large titles"
```

---

### Task 5: Translucent tab bar

Replace the hardcoded 68pt opaque bar with the system default height and a blur material, and let content scroll underneath it.

**Files:**
- Modify: `apps/mobile/app/(app)/(tabs)/_layout.tsx`
- Modify: `apps/mobile/package.json` (via `expo install`)
- Modify: `apps/mobile/src/iosUi.test.ts`

**Interfaces:**
- Consumes: tokens from Task 1; `Screen`'s tab-bar-aware bottom pad from Task 3.

- [ ] **Step 1: Add the failing tab bar assertion**

Append to the `describe` block in `apps/mobile/src/iosUi.test.ts`:

```ts
  it("floats a blurred tab bar at the system height", () => {
    const source = read("../app/(app)/(tabs)/_layout.tsx");

    expect(source).toContain("BlurView");
    expect(source).toContain("tabBarBackground");
    expect(source).toContain('position: "absolute"');
    expect(source).toContain("isReduceTransparencyEnabled");
    expect(source).toContain("reduceTransparencyChanged");
    expect(source).not.toContain("height: 68");
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test --workspace @hbm/mobile -- src/iosUi.test.ts`

Expected: FAIL, the layout still sets `height: 68` and has no `BlurView`.

- [ ] **Step 3: Install expo-blur**

`expo install` resolves the SDK-compatible version, so run it from the app directory rather than adding the dependency by hand:

Run: `cd apps/mobile && npx expo install expo-blur`

Expected: `expo-blur` appears in `apps/mobile/package.json` at the SDK 53 compatible version (`~14.1.x`).

- [ ] **Step 4: Rewrite the tab layout**

Replace the whole of `apps/mobile/app/(app)/(tabs)/_layout.tsx`:

```tsx
import { Tabs } from "expo-router";
import { BlurView } from "expo-blur";
import { useEffect, useState } from "react";
import { AccessibilityInfo, StyleSheet, View } from "react-native";
import { CalendarDays, ChartNoAxesColumnIncreasing, MessageCircle, Settings as SettingsIcon, Sun } from "lucide-react-native";
import { useTheme } from "../../../src/theme/tokens";

export default function TabsLayout() {
  const { tokens, isDark } = useTheme();
  const [reduceTransparency, setReduceTransparency] = useState(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceTransparencyEnabled().then(setReduceTransparency);
    const subscription = AccessibilityInfo.addEventListener(
      "reduceTransparencyChanged",
      setReduceTransparency
    );
    return () => subscription.remove();
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: tokens.tint,
        tabBarInactiveTintColor: tokens.labelSecondary,
        tabBarLabelStyle: { fontSize: 10, fontWeight: "500" },
        // No explicit height: the default 49pt plus the bottom safe-area inset
        // is the system metric. Absolute position plus a transparent background
        // lets screen content scroll under the blur.
        tabBarStyle: {
          backgroundColor: "transparent",
          borderTopColor: tokens.separator,
          borderTopWidth: StyleSheet.hairlineWidth,
          position: "absolute"
        },
        tabBarBackground: () => (
          reduceTransparency
            ? <View style={[StyleSheet.absoluteFill, { backgroundColor: tokens.surface }]} />
            : (
              <BlurView
                intensity={100}
                tint={isDark ? "systemChromeMaterialDark" : "systemChromeMaterialLight"}
                style={StyleSheet.absoluteFill}
              />
            )
        )
      }}
    >
      <Tabs.Screen name="today" options={{ title: "今日", tabBarIcon: ({ color }) => <Sun color={color} size={24} strokeWidth={1.9} /> }} />
      <Tabs.Screen name="plan" options={{ title: "计划", tabBarIcon: ({ color }) => <CalendarDays color={color} size={24} strokeWidth={1.9} /> }} />
      <Tabs.Screen name="coach" options={{ title: "教练", tabBarIcon: ({ color }) => <MessageCircle color={color} size={24} strokeWidth={1.9} /> }} />
      <Tabs.Screen name="insights" options={{ title: "数据", tabBarIcon: ({ color }) => <ChartNoAxesColumnIncreasing color={color} size={24} strokeWidth={1.9} /> }} />
      <Tabs.Screen name="settings" options={{ title: "我的", tabBarIcon: ({ color }) => <SettingsIcon color={color} size={24} strokeWidth={1.9} /> }} />
    </Tabs>
  );
}
```

- [ ] **Step 5: Rebuild the dev client**

`expo-blur` ships native code, so a Metro reload is not enough.

Run: `cd apps/mobile && npx expo run:ios`

Expected: the app builds and installs.

- [ ] **Step 6: Verify on the simulator**

Check: list content is visible through the tab bar while scrolling; labels sit above the home indicator; no content is trapped behind the bar at the end of a long list (Settings is the best test).

Enable Reduce Transparency in the simulator accessibility settings and confirm the tab bar becomes an opaque `surface` instead of remaining blurred.

- [ ] **Step 7: Run tests and typecheck**

Run: `npm test --workspace @hbm/mobile -- src/iosUi.test.ts`

Run: `npm test --workspace @hbm/mobile`

Run: `npx tsc -p apps/mobile/tsconfig.json --noEmit`

Expected: all exit 0.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/package.json package-lock.json "apps/mobile/app/(app)/(tabs)/_layout.tsx" apps/mobile/src/iosUi.test.ts
git commit -m "feat(mobile): float a translucent system-height tab bar"
```

---

### Task 6: Today tab as cards

Give Today a hero card (readiness ring plus the three metrics), a focus card, and the training checklist as a real card — the checklist the user specifically asked for.

**Files:**
- Modify: `apps/mobile/app/(app)/(tabs)/today/index.tsx`
- Modify: `apps/mobile/src/components/QuietHealth.tsx`
- Modify: `apps/mobile/src/iosUi.test.ts`

**Interfaces:**
- Consumes: `InsetGroup`, `Row`, `CheckRow`, `CheckStatus` from Task 2; `Screen`, `Button`, `TextField` from Task 3.
- Produces: unchanged data behaviour — `completeTrainingTask` still receives `{ actualLoad, items }` with the same shape.

- [ ] **Step 1: Add the failing assertion**

Append to the `describe` block in `apps/mobile/src/iosUi.test.ts`:

```ts
  it("builds Today from grouped cards including the training checklist", () => {
    const source = read("../app/(app)/(tabs)/today/index.tsx");

    expect(source).toContain("<InsetGroup");
    expect(source).toContain("<CheckRow");
    expect(source).toContain("styles.heroCard");
    expect(source).not.toContain("<HairlineRow");
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test --workspace @hbm/mobile -- src/iosUi.test.ts`

Expected: FAIL, `today/index.tsx` has no `InsetGroup`.

- [ ] **Step 3: Recolour the shared visual primitives**

In `apps/mobile/src/components/QuietHealth.tsx`, `MetricStrip`, `ReadinessRing`, and `TrendChart` stay but move onto the card surface. Delete `PageHeader` and `HairlineRow` in Task 11; for now change only the colours and the ring number:

- In `MetricStrip`, replace `borderLeftColor: tokens.line` with `tokens.separator`, the label `Text` with `size="caption" color={tokens.labelSecondary}`, and the value `Text` with `size="title3" color={tokens.label} tabularNums`.
- In `ReadinessRing`, replace `stroke={tokens.line}` with `tokens.separator`, `stroke={tokens.sage}` with `tokens.tintFill`, the number `Text` with `size="metric" color={tokens.label} tabularNums`, and the label `Text` with `size="subheadline" color={tokens.labelSecondary}`.
- In `TrendChart`, replace `stroke={tokens.line}` with `tokens.separator`, both `tokens.sage` strokes with `tokens.tint`, and `fill={tokens.bg}` with `tokens.surface`.

- [ ] **Step 4: Rebuild the Today render tree**

In `apps/mobile/app/(app)/(tabs)/today/index.tsx` keep every hook and the `nextChecklistStatus` helper exactly as they are. Replace the `return` of `TodayTab` with:

```tsx
  return (
    <Screen>
      {isLoading ? <Spinner /> : error ? (
        <EmptyState title="今日数据加载失败" description="请确认后端和登录状态仍然可用。" />
      ) : data ? (
        <>
          <View style={[styles.heroCard, { backgroundColor: tokens.surface }]}>
            <Text size="footnote" color={tokens.labelSecondary}>{formatDateLabel(data.date)}</Text>
            <ReadinessRing value={recovery} label={recovery >= 75 ? "准备就绪" : recovery >= 50 ? "适度训练" : "优先恢复"} />
            <View style={[styles.heroDivider, { backgroundColor: tokens.separator }]} />
            <MetricStrip items={[
              { label: "睡眠", value: formatDuration(sleepMinutes), icon: <Moon color={tokens.labelSecondary} size={18} strokeWidth={1.8} /> },
              { label: "恢复", value: percentLabel(recovery), icon: <HeartPulse color={tokens.labelSecondary} size={18} strokeWidth={1.8} /> },
              { label: "活动", value: activityMinutes ? `${activityMinutes} 分` : "—", icon: <Footprints color={tokens.labelSecondary} size={18} strokeWidth={1.8} /> }
            ]} />
          </View>

          <InsetGroup header="今日重点">
            <Row
              title={focusTask ? focusTask.title : "留出恢复空间"}
              subtitle={focusTask
                ? `${formatTaskWindow(focusTask.scheduledStart, focusTask.scheduledEnd)} · ${focusTask.intensity}`
                : data.primaryGoal?.title ?? "今天没有安排训练任务"}
              value={focusTask ? `${focusTask.durationMinutes} 分` : undefined}
            />
            {focusTask ? <Row title="训练类型" value={focusTask.trainingType} /> : null}
          </InsetGroup>

          {focusTask ? <TodayChecklist task={focusTask} /> : (
            <InsetGroup>
              <Row title={data.activePlanId ? "当前周计划已连接" : "尚未生成计划"} subtitle={data.activePlanId ? undefined : "生成计划后，今日重点会显示在这里"} />
            </InsetGroup>
          )}
        </>
      ) : null}
    </Screen>
  );
```

- [ ] **Step 5: Rebuild the checklist as a card**

Replace the `return` of `TodayChecklist` in the same file, keeping its hooks and mutation untouched:

```tsx
  return (
    <>
      <InsetGroup header="训练清单" footer={alreadyRecorded ? "本次训练已记录。" : "点按可在完成、跳过、待办之间切换。"}>
        {task.checklistItems.map((item) => (
          <CheckRow
            key={item.id}
            label={item.label}
            status={statuses[item.id] ?? item.status}
            disabled={alreadyRecorded || completionMutation.isPending}
            onPress={() => setStatuses((items) => ({
              ...items,
              [item.id]: nextChecklistStatus(statuses[item.id] ?? item.status)
            }))}
          />
        ))}
        <TextField
          label="实际负荷"
          value={actualLoad}
          onChange={setActualLoad}
          placeholder="可选"
          keyboardType="number-pad"
          editable={!alreadyRecorded && !completionMutation.isPending}
        />
      </InsetGroup>

      <Button
        title={alreadyRecorded ? "已记录" : completionMutation.isPending ? "提交中" : "提交完成"}
        disabled={alreadyRecorded || completionMutation.isPending}
        onPress={() => completionMutation.mutate()}
      />
    </>
  );
```

- [ ] **Step 6: Replace the stylesheet**

Replace the `styles` of `apps/mobile/app/(app)/(tabs)/today/index.tsx`:

```tsx
const styles = StyleSheet.create({
  heroCard: {
    alignItems: "center",
    borderRadius: radius.md,
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.lg
  },
  heroDivider: { alignSelf: "stretch", height: StyleSheet.hairlineWidth }
});
```

Update the imports at the top of the file: drop `Pressable`, `TextInput`, `Check`, `Circle`, and `opacity`; add `InsetGroup` from `../../../../src/components/InsetGroup`, `CheckRow` from `../../../../src/components/CheckRow`, `Row` from `../../../../src/components/Row`, `TextField` from `../../../../src/components/TextField`, and `radius` from the theme.

- [ ] **Step 7: Run tests, typecheck, and look at it**

Run: `npm test --workspace @hbm/mobile -- src/iosUi.test.ts`

Run: `npm test --workspace @hbm/mobile -- src/trainingFlows.test.ts`

Run: `npm test --workspace @hbm/mobile`

Run: `npx tsc -p apps/mobile/tsconfig.json --noEmit`

Expected: all exit 0. `trainingFlows.test.ts` still finds `completeTrainingTask`, `useMutation`, and `提交完成`.

Check on the simulator: the ring sits on a white card, the checklist is a grouped card whose last row has no separator, and toggling a row still posts on submit.

- [ ] **Step 8: Commit**

```bash
git add "apps/mobile/app/(app)/(tabs)/today/index.tsx" apps/mobile/src/components/QuietHealth.tsx apps/mobile/src/iosUi.test.ts
git commit -m "feat(mobile): rebuild Today around grouped cards and a checklist card"
```

---

### Task 7: Plan tab as cards

**Files:**
- Modify: `apps/mobile/app/(app)/(tabs)/plan/index.tsx`
- Modify: `apps/mobile/src/iosUi.test.ts`

**Interfaces:**
- Consumes: `InsetGroup`, `Row` from Task 2; the `headerRight` action added in Task 4.
- Produces: unchanged mutations — `generateActivePlan(currentWeekStartIso())` and `confirmCalendarDraft(draft.id)`.

- [ ] **Step 1: Add the failing assertion**

Append to the `describe` block in `apps/mobile/src/iosUi.test.ts`:

```ts
  it("builds Plan from grouped cards with a card week strip", () => {
    const source = read("../app/(app)/(tabs)/plan/index.tsx");

    expect(source).toContain("<InsetGroup");
    expect(source).toContain("styles.weekStrip");
    expect(source).toContain("headerRight");
    expect(source).not.toContain("<HairlineRow");
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test --workspace @hbm/mobile -- src/iosUi.test.ts`

Expected: FAIL, `plan/index.tsx` still uses `HairlineRow`.

- [ ] **Step 3: Move the week strip onto a card and regroup the sections**

Keep every hook, `nutrition`, `weekDays`, `TrainingTimeline`, and both mutations. Replace the JSX from the `<View style={styles.weekStrip}>` block through the end of the `data ?` branch:

```tsx
      <View style={[styles.weekStrip, { backgroundColor: tokens.surface }]}>
        {weekDays.map((day) => (
          <View key={day.name} style={styles.dayItem}>
            <Text size="caption2" color={tokens.labelSecondary}>周{day.name}</Text>
            <View style={[styles.dayCircle, day.active ? { backgroundColor: tokens.controlFill } : null]}>
              <Text size="callout" color={day.active ? tokens.controlLabel : tokens.label} tabularNums>{day.day}</Text>
            </View>
          </View>
        ))}
      </View>

      {isLoading ? <Spinner /> : error ? (
        <EmptyState title="计划加载失败" description="请稍后重试或重新登录。" />
      ) : data ? (
        <>
          <View style={[styles.primaryCard, { backgroundColor: tokens.surface }]}>
            <Text size="footnote" color={tokens.tint}>星期一</Text>
            <View style={styles.sessionTitleRow}>
              <View style={[styles.sessionIcon, { backgroundColor: tokens.fill }]}>
                <Dumbbell color={tokens.tint} size={24} strokeWidth={1.8} />
              </View>
              <View style={styles.sessionCopy}>
                <Text size="title2" color={tokens.label}>{primaryTask?.title ?? data.summary}</Text>
                <Text size="subheadline" color={tokens.labelSecondary}>
                  {primaryTask ? `${primaryTask.durationMinutes} 分钟 · ${primaryTask.intensity}` : `${data.trainingTasks.length} 个训练任务`}
                </Text>
              </View>
            </View>
            {primaryTask ? <TrainingTimeline duration={primaryTask.durationMinutes} /> : null}
          </View>

          <InsetGroup header="训练安排">
            {data.trainingTasks.slice(1).flatMap((task) => [
              <Row
                key={task.id}
                title={task.title}
                subtitle={`${formatDateLabel(task.date)} · ${formatTaskWindow(task.scheduledStart, task.scheduledEnd)} · ${task.intensity}`}
                value={`${task.durationMinutes} 分`}
                onPress={() => setExpandedTaskId((current) => (current === task.id ? null : task.id))}
              />,
              ...(expandedTaskId === task.id
                ? task.checklistItems.length
                  ? task.checklistItems.map((item) => (
                    <Row key={`${task.id}-${item.id}`} title={item.label} />
                  ))
                  : [<Row key={`${task.id}-empty`} title="这个任务没有拆分步骤" />]
                : [])
            ])}
          </InsetGroup>

          <InsetGroup header="饮食" insetSeparators>
            <Row
              icon={<Utensils color={tokens.tint} size={20} strokeWidth={1.8} />}
              title="蛋白目标"
              subtitle={String(nutrition.carbohydrateGuidance)}
              value={typeof nutrition.proteinTargetGrams === "number" ? `${nutrition.proteinTargetGrams}g` : "未设置"}
            />
            <Row
              icon={<Utensils color={tokens.tint} size={20} strokeWidth={1.8} />}
              title="热量目标"
              value={String(nutrition.calorieTarget)}
            />
          </InsetGroup>

          <InsetGroup header="日历草稿" insetSeparators>
            {drafts.data?.length ? drafts.data.map((draft) => (
              <Row
                key={draft.id}
                icon={<CalendarCheck color={draft.status === "failed" ? tokens.red : tokens.tint} size={20} strokeWidth={1.8} />}
                title={draft.title}
                subtitle={`${formatTaskWindow(draft.startsAt, draft.endsAt)}${draft.failureReason ? ` · ${draft.failureReason}` : ""}`}
                value={confirmMutation.isPending && confirmMutation.variables === draft.id
                  ? "写入中"
                  : draft.status === "failed" ? "重试" : draft.operation === "cancel" ? "确认取消" : "确认"}
                onPress={() => confirmMutation.mutate(draft.id)}
              />
            )) : <Row title="没有待确认的日历变更" />}
          </InsetGroup>
        </>
      ) : (
        <View style={styles.emptyPlan}>
          <EmptyState title="暂无当前计划" description="生成后，这里会显示一周训练和饮食节奏。" />
          <Button title="生成本周计划" onPress={() => generateMutation.mutate()} disabled={generateMutation.isPending} />
        </View>
      )}
```

- [ ] **Step 4: Recolour the timeline and replace the stylesheet**

In `TrainingTimeline`, replace `backgroundColor: tokens.sage` with `tokens.tint`, `borderColor: tokens.sage` with `tokens.tint`, `backgroundColor: tokens.bg` with `tokens.surface`, and the three label pairs with `<Text size="footnote" color={tokens.label}>` and `<Text size="caption" color={tokens.labelSecondary}>`.

Replace the `styles` of the file:

```tsx
const styles = StyleSheet.create({
  dayCircle: { alignItems: "center", borderRadius: 16, height: 32, justifyContent: "center", width: 32 },
  dayItem: { alignItems: "center", flex: 1, gap: spacing.xs },
  emptyPlan: { gap: spacing.lg },
  primaryCard: { borderRadius: radius.md, gap: spacing.lg, marginHorizontal: spacing.lg, padding: spacing.lg },
  sessionCopy: { flex: 1, gap: spacing.xs },
  sessionIcon: { alignItems: "center", borderRadius: 24, height: 48, justifyContent: "center", width: 48 },
  sessionTitleRow: { alignItems: "center", flexDirection: "row", gap: spacing.md },
  timeline: { gap: spacing.sm },
  timelineLabels: { flexDirection: "row", justifyContent: "space-between" },
  timelineTrack: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingHorizontal: spacing.md },
  trackDot: { borderRadius: 6, borderWidth: 2, height: 12, width: 12 },
  trackLine: { height: 2, left: 0, position: "absolute", right: 0 },
  weekStrip: {
    borderRadius: radius.md,
    flexDirection: "row",
    marginHorizontal: spacing.lg,
    paddingVertical: spacing.md
  }
});
```

Update imports: drop `HairlineRow` and `PageHeader`; add `InsetGroup` and `Row`; add `radius` to the theme import.

- [ ] **Step 5: Run tests and typecheck**

Run: `npm test --workspace @hbm/mobile -- src/iosUi.test.ts src/trainingFlows.test.ts`

Run: `npm test --workspace @hbm/mobile`

Run: `npx tsc -p apps/mobile/tsconfig.json --noEmit`

Expected: exit 0. Check on the simulator that expanding a training row inserts its steps as sub-rows inside the same card.

- [ ] **Step 6: Commit**

```bash
git add "apps/mobile/app/(app)/(tabs)/plan/index.tsx" apps/mobile/src/iosUi.test.ts
git commit -m "feat(mobile): rebuild Plan around grouped cards"
```

---

### Task 8: Insights tab as cards

**Files:**
- Modify: `apps/mobile/app/(app)/(tabs)/insights/index.tsx`
- Modify: `apps/mobile/src/iosUi.test.ts`

**Interfaces:**
- Consumes: `InsetGroup`, `Row` from Task 2; the recoloured `TrendChart` from Task 6.

- [ ] **Step 1: Add the failing assertion**

```ts
  it("builds Insights from a stat card, a chart card, and a grouped list", () => {
    const source = read("../app/(app)/(tabs)/insights/index.tsx");

    expect(source).toContain("<InsetGroup");
    expect(source).toContain("styles.statCard");
    expect(source).toContain("styles.chartCard");
    expect(source).not.toContain("<HairlineRow");
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test --workspace @hbm/mobile -- src/iosUi.test.ts`

Expected: FAIL, no `InsetGroup` in `insights/index.tsx`.

- [ ] **Step 3: Rebuild the render tree**

Keep every hook and the derived values. Replace the `return` of `InsightsTab`:

```tsx
  return (
    <Screen>
      {isLoading ? <Spinner /> : hasError ? (
        <EmptyState title="数据加载失败" description="请确认登录状态和后端服务。" />
      ) : (
        <>
          <View style={[styles.statCard, { backgroundColor: tokens.surface }]}>
            <Text size="footnote" color={tokens.labelSecondary}>恢复趋势 · 最近 4 周</Text>
            <Text size="metric" color={tokens.label} tabularNums>
              {recoveryDelta >= 0 ? "+" : ""}{recoveryDelta}%
            </Text>
            <Text size="subheadline" color={recoveryDelta >= 0 ? tokens.tint : tokens.red}>
              {recoveryDelta >= 0 ? "恢复状态正在上升" : "恢复状态需要关注"}
            </Text>
          </View>

          <View style={[styles.chartCard, { backgroundColor: tokens.surface }]}>
            {recoveryValues.length ? <TrendChart values={recoveryValues} /> : (
              <EmptyState title="暂无恢复趋势" description="同步 COROS 后会显示趋势。" />
            )}
            {recovery.data?.length ? (
              <View style={styles.chartLabels}>
                <Text size="caption" color={tokens.labelSecondary}>{formatDateLabel(recovery.data.at(-1)?.date ?? "")}</Text>
                <Text size="caption" color={tokens.labelSecondary}>现在 · {latestRecovery}%</Text>
              </View>
            ) : null}
          </View>

          <InsetGroup header="分析" insetSeparators>
            <Row
              icon={<Moon color={tokens.tint} size={20} strokeWidth={1.8} />}
              title="平均睡眠"
              subtitle={sleep.data?.[0]?.qualityScore ? `最近质量评分 ${sleep.data[0].qualityScore}` : "持续同步可获得更准趋势"}
              value={formatDuration(averageSleep)}
            />
            <Row
              icon={<Dumbbell color={tokens.tint} size={20} strokeWidth={1.8} />}
              title="训练负荷"
              subtitle={`${activities.data?.length ?? 0} 次最近活动`}
              value={averageLoad === null ? "—" : averageLoad < 40 ? "偏轻" : averageLoad > 90 ? "偏高" : "平衡"}
            />
            <Row
              icon={<Activity color={tokens.tint} size={20} strokeWidth={1.8} />}
              title="最近活动"
              subtitle={activities.data?.[0] ? `${formatDateLabel(activities.data[0].startedAt)} · ${formatDuration(activities.data[0].durationMinutes)}` : "暂无记录"}
              value={activities.data?.[0] ? numberLabel(activities.data[0].averageHeartRateBpm, " bpm") : "—"}
            />
          </InsetGroup>
        </>
      )}
    </Screen>
  );
```

Replace the `styles`:

```tsx
const styles = StyleSheet.create({
  chartCard: { borderRadius: radius.md, gap: spacing.sm, marginHorizontal: spacing.lg, padding: spacing.lg },
  chartLabels: { flexDirection: "row", justifyContent: "space-between" },
  statCard: { borderRadius: radius.md, gap: spacing.xs, marginHorizontal: spacing.lg, padding: spacing.lg }
});
```

Update imports: drop `HairlineRow` and `PageHeader`, add `InsetGroup` and `Row`, add `radius`.

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test --workspace @hbm/mobile -- src/iosUi.test.ts`

Run: `npm test --workspace @hbm/mobile`

Run: `npx tsc -p apps/mobile/tsconfig.json --noEmit`

Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add "apps/mobile/app/(app)/(tabs)/insights/index.tsx" apps/mobile/src/iosUi.test.ts
git commit -m "feat(mobile): rebuild Insights around stat and chart cards"
```

---

### Task 9: Settings tab and the eight detail pages as grouped cards

**Files:**
- Modify: `apps/mobile/app/(app)/(tabs)/settings/index.tsx`
- Modify: all eight `apps/mobile/app/(app)/(tabs)/settings/<detail>.tsx`
- Modify: `apps/mobile/src/iosUi.test.ts`

**Interfaces:**
- Consumes: `InsetGroup`, `Row` from Task 2; `TextField`, `ChoiceGroup`, `Button` from Task 3.
- Produces: no behaviour change. Every `router.push`, mutation, and `confirm` call stays.

**Mechanical transformation applied to all nine files:**
- `<Section title="X">` becomes `<InsetGroup header="X">`; a `Section` with an `action` keeps it by moving the control to the first `Row`'s `trailing`.
- `<HairlineRow .../>` becomes `<Row .../>` with identical props; add `insetSeparators` to the enclosing `InsetGroup` when its rows carry a leading `icon`.
- A bare intro `<Text>` above the first group becomes that group's `footer`, or a `footer` on the last group when it is a closing caveat.
- Wrapping `<View>` elements that only existed to bundle `HairlineRow`s are deleted; `InsetGroup` is the container now.

- [ ] **Step 1: Add the failing assertion**

```ts
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test --workspace @hbm/mobile -- src/iosUi.test.ts`

Expected: FAIL, the settings files still use `Section`.

- [ ] **Step 3: Rebuild the settings root**

In `apps/mobile/app/(app)/(tabs)/settings/index.tsx` keep every hook and `requestSignOut`. Replace the `return`:

```tsx
  return (
    <Screen>
      <InsetGroup>
        <Row
          icon={<View style={[styles.avatar, { backgroundColor: tokens.controlFill }]}><Text size="footnote" color={tokens.controlLabel}>{initials}</Text></View>}
          title="个人健康空间"
          subtitle={account.error ? "账户信息加载失败" : accountEmail}
          onPress={() => router.push("/(app)/(tabs)/settings/profile-settings")}
        />
      </InsetGroup>

      <InsetGroup header="账户" insetSeparators>
        <Row icon={<UserRound {...iconProps} />} title="个人资料" subtitle="身体数据、限制和偏好" onPress={() => router.push("/(app)/(tabs)/settings/profile-settings")} />
        <Row icon={<Shield {...iconProps} />} title="账户安全" subtitle="修改密码会退出所有设备" onPress={() => router.push("/(app)/(tabs)/settings/account-security")} />
      </InsetGroup>

      <InsetGroup header="数据与连接" insetSeparators>
        <Row icon={<HeartPulse {...iconProps} />} title="Apple 健康" subtitle="授权并同步 HealthKit" onPress={() => router.push("/(app)/(tabs)/settings/healthkit-settings")} />
        <Row
          icon={<Cloud {...iconProps} />}
          title="自动同步"
          subtitle={automations.data?.length ? `${automations.data.length} 个后台任务` : "后台任务尚未运行"}
          value={automationSummary}
          trailing={showAutomations
            ? <ChevronUp color={tokens.labelTertiary} size={18} strokeWidth={2.2} />
            : <ChevronDown color={tokens.labelTertiary} size={18} strokeWidth={2.2} />}
          onPress={() => setShowAutomations((value) => !value)}
        />
        {showAutomations
          ? automations.data?.length
            ? automations.data.map((item) => (
              <Row key={item.kind} title={item.kind} subtitle={item.lastError ?? undefined} value={item.status} destructive={item.status === "failed"} />
            ))
            : [<Row key="no-automations" title="还没有自动任务运行记录" />]
          : []}
        <Row icon={<KeyRound {...iconProps} />} title="模型运行时" value={settings.data?.hasApiKey ? settings.data.modelProvider : "未配置密钥"} onPress={() => router.push("/(app)/(tabs)/settings/model-settings")} />
        <Row icon={<Link {...iconProps} />} title="连接配置" subtitle="维护 Endpoint、开关和访问令牌" onPress={() => router.push("/(app)/(tabs)/settings/connection-settings")} />
        <Row icon={<Watch {...iconProps} />} title="COROS" subtitle="浏览器登录授权" value={mcpConnectionStatus(connection("coros"))} onPress={() => router.push("/(app)/(tabs)/settings/connection-settings")} />
        <Row icon={<CalendarDays {...iconProps} />} title="日历" value={mcpConnectionStatus(connection("calendar"))} onPress={() => router.push("/(app)/(tabs)/settings/connection-settings")} />
        <Row icon={<Utensils {...iconProps} />} title="餐食菜单" value={mcpConnectionStatus(connection("meal_menu"))} onPress={() => router.push("/(app)/(tabs)/settings/connection-settings")} />
      </InsetGroup>

      <InsetGroup header="偏好" insetSeparators>
        <Row icon={<Cloud {...iconProps} />} title="外观" subtitle="跟随系统的浅色与深色模式" value="跟随系统" />
        <Row icon={<Ruler {...iconProps} />} title="单位" subtitle="距离用公里，体重用公斤" value="公制" />
        <Row icon={<Bell {...iconProps} />} title="通知与提醒" subtitle="训练开始前 30 分钟提醒" onPress={() => router.push("/(app)/(tabs)/settings/notification-settings")} />
      </InsetGroup>

      <InsetGroup header="目标" insetSeparators>
        <Row icon={<Target {...iconProps} />} title="管理目标" subtitle="新建、编辑或暂停目标" onPress={() => router.push("/(app)/(tabs)/settings/goal-settings")} />
        {goals.isLoading
          ? [<Row key="goals-loading" title="正在读取目标…" />]
          : goals.error
            ? [<Row key="goals-error" title="目标加载失败" subtitle="请确认后端服务" destructive />]
            : goals.data?.length
              ? goals.data.slice(0, 4).map((goal) => (
                <Row key={goal.id} icon={<Target {...iconProps} />} title={goal.title} subtitle={`${goal.status} · 优先级 ${goal.priority}`} onPress={() => router.push("/(app)/(tabs)/settings/goal-settings")} />
              ))
              : [<Row key="goals-empty" icon={<Target {...iconProps} />} title="暂无目标" subtitle="目标会影响计划和教练建议" />]}
      </InsetGroup>

      <InsetGroup header="隐私" insetSeparators>
        <Row icon={<Brain {...iconProps} />} title="Agent 记忆" subtitle="在教练页的记忆面板中管理" value={profile.data ? "可用" : "同步中"} />
        <Row icon={<Download {...iconProps} />} title="导出数据" subtitle="生成脱敏 JSON 文件" onPress={() => router.push("/(app)/(tabs)/settings/data-export")} />
      </InsetGroup>

      <InsetGroup>
        <Row title="退出登录" destructive onPress={requestSignOut} />
      </InsetGroup>
    </Screen>
  );
```

Replace the `styles`:

```tsx
const styles = StyleSheet.create({
  avatar: { alignItems: "center", borderRadius: 14, height: 28, justifyContent: "center", width: 28 }
});
```

Change `iconProps` to `{ color: tokens.tint, size: 20, strokeWidth: 1.8 } as const`. Update imports: drop `Section`, `HairlineRow`, `PageHeader`, `EmptyState`, `Spinner`, `LogOut`; add `InsetGroup` and `Row`.

- [ ] **Step 4: Convert the two smallest detail pages**

`healthkit-settings.tsx` — replace the `return`:

```tsx
  return (
    <Screen>
      <InsetGroup header="上次同步" footer="只读取你明确授权的数据，最近 14 天数据会同步到个人健康空间。">
        <Row title="睡眠记录" value={imported ? `${imported.sleep} 条` : "尚未同步"} />
        <Row title="恢复记录" value={imported ? `${imported.recovery} 条` : "尚未同步"} />
      </InsetGroup>

      <InsetGroup header="读取范围" footer="不会向 Apple 健康写入任何数据。">
        <Row title="身体数据" value="身高 体重 体脂" />
        <Row title="心脏与睡眠" value="静息心率 HRV 睡眠" />
      </InsetGroup>

      <Button title={busy ? "同步中…" : "授权并同步"} disabled={busy} onPress={sync} />
    </Screen>
  );
```

Drop the now-unused `Text`, `Section`, `HairlineRow`, and `useTheme` imports; add `InsetGroup` and `Row`.

`notification-settings.tsx` — replace the `return`:

```tsx
  return (
    <Screen>
      <InsetGroup header="训练提醒" footer="训练开始前 30 分钟提醒；每次更新会与当前计划重新对齐。">
        <Row title="本地提醒" subtitle="无需服务器即可工作" value={reminders === null ? "尚未启用" : `${reminders} 条`} />
        <Row title="远程推送" subtitle="配置 EAS Project ID 后可用" value={remoteStatus ?? "尚未启用"} />
      </InsetGroup>

      <Button title={busy ? "配置中…" : "启用并同步提醒"} disabled={busy || plan.isLoading} onPress={enable} />
    </Screen>
  );
```

Drop the unused `Text`, `Section`, `HairlineRow`, and `useTheme` imports; add `InsetGroup` and `Row`.

- [ ] **Step 5: Convert the remaining six detail pages**

Apply the mechanical transformation listed above to `data-export.tsx`, `account-security.tsx`, `model-settings.tsx`, `profile-settings.tsx`, `goal-settings.tsx`, and `connection-settings.tsx`. Page-specific notes:

- `profile-settings.tsx`: each `Section` of `TextField`s becomes an `InsetGroup`; the `ChoiceGroup`s for 性别 and 训练经验 go into their own `InsetGroup header="偏好"` as direct children (they are not `Row`s, so the group still separates them correctly).
- `model-settings.tsx`: the provider `ChoiceGroup` becomes the sole child of `<InsetGroup header="模型提供方">`; the API key and base URL `TextField`s share `<InsetGroup header="凭据">`.
- `connection-settings.tsx`: each connection keeps its own `InsetGroup`, and the `Switch` that was the `Section` action becomes the first `Row`'s `trailing`.
- `goal-settings.tsx`: the goal list becomes one `InsetGroup header="目标"` of `Row`s; the create form becomes `<InsetGroup header="新建目标">` of `TextField`s followed by a `Button`.
- `account-security.tsx`: the password fields share `<InsetGroup header="修改密码">`; the delete action becomes `<InsetGroup><Row title="删除账户" destructive onPress={removeAccount} /></InsetGroup>`.
- `data-export.tsx`: the copy block becomes the `footer` of `<InsetGroup header="包含内容">`.

- [ ] **Step 6: Run tests, lint, and typecheck**

Run: `npm test --workspace @hbm/mobile -- src/iosUi.test.ts`

Run: `npm test --workspace @hbm/mobile -- src/settingsStatus.test.ts`

Run: `npm test --workspace @hbm/mobile`

Run: `npm run lint --workspace @hbm/mobile`

Run: `npx tsc -p apps/mobile/tsconfig.json --noEmit`

Expected: all exit 0. Lint catches any import left unused by the conversion.

- [ ] **Step 7: Commit**

```bash
git add "apps/mobile/app/(app)/(tabs)/settings" apps/mobile/src/iosUi.test.ts
git commit -m "feat(mobile): rebuild settings tree as iOS grouped cards"
```

---

### Task 10: Coach as a native chat screen

The coach header is the worst offender for wasted space: a 36pt title, a subtitle, and a 42pt toolbar cost about 195pt before the first message. Moving all of it into the native header cuts that to 103pt.

**Files:**
- Modify: `apps/mobile/app/(app)/(tabs)/coach/index.tsx`
- Modify: `apps/mobile/src/coachLayout.test.ts`
- Modify: `apps/mobile/src/iosUi.test.ts`

**Interfaces:**
- Consumes: `useNativeHeaderOptions` from Task 4; `InsetGroup` and `Row` from Task 2.
- Produces: unchanged coach behaviour — `submitMessage`, `requestDeleteConversation`, `openConversationDrawer`, `closeConversationDrawer(onClosed?)`, the memory sheet, and undo all stay.

- [ ] **Step 1: Rewrite the coach layout contract**

`coachLayout.test.ts` currently pins the hand-rolled header. Replace its first and last `it` blocks (keep the middle three — independent message scrolling, the memory bottom sheet, and the drawer safe area still hold):

```ts
  it("uses a native header instead of a hand-rolled one", () => {
    const source = readFileSync(new URL("../app/(app)/(tabs)/coach/index.tsx", import.meta.url), "utf8");

    expect(source).toContain("navigation.setOptions");
    expect(source).toContain("headerLeft");
    expect(source).toContain("headerRight");
    expect(source).not.toContain("styles.headerLayer");
    expect(source).not.toContain("styles.coachHeader");
    expect(source).not.toContain("styles.chatToolbar");
    expect(source).not.toContain('size="display"');
  });

  it("keeps the chat stage and composer docked below the header", () => {
    const source = readFileSync(new URL("../app/(app)/(tabs)/coach/index.tsx", import.meta.url), "utf8");

    const bodyIndex = source.indexOf("styles.chatBody");
    const messagesIndex = source.indexOf("styles.messageScroll");
    const composerIndex = source.indexOf("styles.composerDock");

    expect(source).toContain("KeyboardAvoidingView");
    expect(source).toContain("Platform.OS");
    expect(source).toContain("showConversationDrawer");
    expect(bodyIndex).toBeGreaterThan(-1);
    expect(bodyIndex).toBeLessThan(messagesIndex);
    expect(messagesIndex).toBeLessThan(composerIndex);
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test --workspace @hbm/mobile -- src/coachLayout.test.ts`

Expected: FAIL, the file still contains `styles.headerLayer`.

- [ ] **Step 3: Move the toolbar into the native header**

In `apps/mobile/app/(app)/(tabs)/coach/index.tsx`, add `useNavigation` to the `expo-router` import and register the header controls after `selectedConversation` is available:

```tsx
  const navigation = useNavigation();

  // The whole toolbar moves into the native bar: title in the middle, history
  // on the left, memory and new-chat on the right.
  useEffect(() => {
    navigation.setOptions({
      title: selectedConversation?.title ?? "新对话",
      headerLeft: () => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="历史对话"
          hitSlop={11}
          onPress={openConversationDrawer}
          style={styles.headerAction}
        >
          <History color={tokens.tint} size={22} strokeWidth={1.9} />
        </Pressable>
      ),
      headerRight: () => (
        <View style={styles.headerActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="教练记忆"
            hitSlop={11}
            onPress={() => setShowCoachTools(true)}
            style={styles.headerAction}
          >
            <Brain color={tokens.tint} size={21} strokeWidth={1.9} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="新对话"
            accessibilityState={{ disabled: createConversationMutation.isPending }}
            hitSlop={11}
            onPress={() => createConversationMutation.mutate()}
            disabled={createConversationMutation.isPending}
            style={styles.headerAction}
          >
            <SquarePen color={createConversationMutation.isPending ? tokens.labelTertiary : tokens.tint} size={22} strokeWidth={1.9} />
          </Pressable>
        </View>
      )
    });
  }, [createConversationMutation, navigation, openConversationDrawer, selectedConversation?.title, tokens]);
```

Then delete the entire `<View style={styles.headerLayer}>` block (the `coachHeader` and `chatToolbar` markup) from the render tree, and drop the `SafeAreaView` wrapper with `edges={["top"]}` — the native header owns the top inset now. The outermost element becomes the `KeyboardAvoidingView`, wrapped in a `View` with `styles.screen` and the `bg` background.

- [ ] **Step 4: Restyle bubbles and composer to iOS**

In the same file's `styles`, replace these entries:

```tsx
  composerDock: {
    alignItems: "flex-end",
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm
  },
  headerAction: { alignItems: "center", height: 44, justifyContent: "center", width: 44 },
  headerActions: { alignItems: "center", flexDirection: "row" },
  input: {
    borderRadius: radius.bubble,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    fontSize: 17,
    maxHeight: 110,
    minHeight: 36,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  messageBubble: { borderRadius: radius.bubble, gap: spacing.xs, maxWidth: "88%", padding: spacing.md },
  sendButton: { alignItems: "center", borderRadius: 16, height: 32, justifyContent: "center", width: 32 },
  userBubble: { borderRadius: radius.bubble, maxWidth: "82%", paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
```

In `MessageBubble`, give the user bubble `backgroundColor: tokens.controlFill` with `color={tokens.controlLabel}` text and no border; give the assistant bubble `backgroundColor: tokens.surface` and no border. In the composer, set the send button's background to `tokens.controlFill` with an enabled icon colour of `tokens.controlLabel`, and `tokens.fill` with `tokens.labelTertiary` when disabled.

Give the composer clearance for the floating tab bar by adding the same context read used by `Screen`:

```tsx
  const tabBarHeight = useContext(BottomTabBarHeightContext) ?? 0;
```

and applying `style={[styles.composerDock, { backgroundColor: tokens.bg, borderTopColor: tokens.separator, paddingBottom: spacing.sm + tabBarHeight }]}`.

- [ ] **Step 5: Convert the memory rows to grouped cards**

`MemoryRow` and `MemoryEditor` are the last two `Card` users. Replace `<Card style={styles.memoryCard}>` with `<InsetGroup>` wrapping a `Row`, and `<Card style={styles.memoryEditor}>` with `<InsetGroup header="编辑记忆">`. Delete the `Card` import.

- [ ] **Step 6: Add the coach assertion to the UI contract**

Append to the `describe` block in `apps/mobile/src/iosUi.test.ts`:

```ts
  it("leaves no Card users behind in coach", () => {
    expect(read("../app/(app)/(tabs)/coach/index.tsx")).not.toContain("components/Card");
  });
```

- [ ] **Step 7: Run tests, typecheck, and check the keyboard**

Run: `npm test --workspace @hbm/mobile -- src/coachLayout.test.ts src/coachLifecycle.test.ts src/iosUi.test.ts`

Run: `npm test --workspace @hbm/mobile`

Run: `npx tsc -p apps/mobile/tsconfig.json --noEmit`

Expected: exit 0.

Check on the simulator: the composer rises with the keyboard and is never hidden behind the tab bar; the history drawer and memory sheet still open; deleting a conversation still asks for confirmation.

- [ ] **Step 8: Commit**

```bash
git add "apps/mobile/app/(app)/(tabs)/coach/index.tsx" apps/mobile/src/coachLayout.test.ts apps/mobile/src/iosUi.test.ts
git commit -m "feat(mobile): move coach chrome into the native header and restyle bubbles"
```

---

### Task 11: Migrate auth screens, delete the deprecated layer, verify

Every screen now speaks iOS. This task migrates the two auth screens, deletes the compatibility aliases and retired primitives, and lets `tsc` prove nothing was missed.

**Files:**
- Modify: `apps/mobile/app/(auth)/login.tsx`, `apps/mobile/app/(auth)/register.tsx`
- Modify: `apps/mobile/src/components/QuietHealth.tsx`
- Modify: `apps/mobile/src/components/Feedback.tsx`, `apps/mobile/src/components/RichMessage.tsx`, `apps/mobile/src/components/States.tsx`
- Modify: `apps/mobile/src/theme/tokens.ts`, `apps/mobile/src/components/Button.tsx`
- Delete: `apps/mobile/src/components/Card.tsx`, `apps/mobile/src/components/Card.test.tsx`, `apps/mobile/src/components/Section.tsx`
- Modify: `apps/mobile/src/iosUi.test.ts`

**Interfaces:**
- Produces: a token set with no legacy aliases, `textStyles` with no legacy keys, `radius` with no legacy keys, and `Button` with only the four iOS variants.

- [ ] **Step 1: Add the failing cleanup assertion**

Append to the `describe` block in `apps/mobile/src/iosUi.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test --workspace @hbm/mobile -- src/iosUi.test.ts`

Expected: FAIL, tokens still export `withLegacyAliases`.

- [ ] **Step 3: Give the auth screens their own large title**

The auth stack has no native header, so these two keep a local title block. In `apps/mobile/app/(auth)/login.tsx`, replace the `PageHeader` element with:

```tsx
      <View style={styles.header}>
        <Text size="largeTitle" color={tokens.label}>登录</Text>
        <Text size="subheadline" color={tokens.labelSecondary}>Healthy Body Manager</Text>
      </View>
```

and add to its `styles`: `header: { gap: spacing.xs, paddingHorizontal: spacing.lg, paddingTop: spacing.xxl },`. Wrap the two `TextField`s in `<InsetGroup>` instead of `styles.form`, and move the `error` / `notice` `Text` elements to `paddingHorizontal: spacing.lg`. Drop the `PageHeader` import.

Apply the same treatment to `apps/mobile/app/(auth)/register.tsx` with the title `注册`.

- [ ] **Step 4: Migrate the last legacy token and size names**

Three shared components still use aliases. Replace them:

- `apps/mobile/src/components/States.tsx`: `tokens.sage` becomes `tokens.tint`; `tokens.muted` becomes `tokens.labelSecondary`; `size="sm"` becomes `size="subheadline"`.
- `apps/mobile/src/components/Feedback.tsx`: `tokens.danger` becomes `tokens.red`; `tokens.lineStrong` becomes `tokens.separatorOpaque`; `tokens.sage` becomes `tokens.tint`; `tokens.panel` becomes `tokens.surface`; `size="sm"` becomes `size="subheadline"`.
- `apps/mobile/src/components/RichMessage.tsx`: `size="sm"` becomes `size="subheadline"`, `size="xs"` becomes `size="caption"`, and any `tokens.muted` becomes `tokens.labelSecondary`.

- [ ] **Step 5: Delete the retired primitives**

`PageHeader` and `HairlineRow` have no callers left; `Card` and `Section` were replaced by `InsetGroup`.

```bash
git rm apps/mobile/src/components/Card.tsx apps/mobile/src/components/Card.test.tsx apps/mobile/src/components/Section.tsx
```

In `apps/mobile/src/components/QuietHealth.tsx`, delete the `PageHeader` and `HairlineRow` functions plus their now-unused styles (`pageHeader`, `headerCopy`, `hairlineRow`, `rowCopy`, `rowIcon`, `pressed`) and the `ChevronRight` and `opacity` imports. `MetricStrip`, `ReadinessRing`, and `TrendChart` stay.

- [ ] **Step 6: Delete the compatibility layer**

In `apps/mobile/src/theme/tokens.ts`, delete `withLegacyAliases` and export the bases directly:

```ts
export const lightTokens = lightBase;
export const darkTokens = darkBase;

export type ThemeTokens = { [K in keyof BaseTokens]: string };
```

Delete the eight deprecated entries from `textStyles` (`xs`, `sm`, `md`, `lg`, `xl`, `xxl`, `display`, `hero`) and the two deprecated `radius` entries (`lg`, `xl`). `Text.tsx` keeps only the semantic `headline` entry in `semiboldSizes`.

In `apps/mobile/src/components/Button.tsx`, delete the `aliases` map and narrow `Variant` to `"filled" | "tinted" | "plain" | "destructive"`, using `variant` directly.

- [ ] **Step 7: Let the compiler find every straggler**

Run: `npx tsc -p apps/mobile/tsconfig.json --noEmit`

Expected: FAIL initially, with one error per remaining legacy name (for example `Property 'sage' does not exist on type 'ThemeTokens'` or `Type '"md"' is not assignable`). Fix each using the Task 1 mapping — `panel`→`surface`, `panelSoft`→`surfaceAlt`, `ink`/`inkStrong`→`label`, `muted`→`labelSecondary`, `line`→`separator`, `lineStrong`→`separatorOpaque`, `sage`/`sageStrong`/`clay`→`tint`, `sageSoft`/`claySoft`→`fill`, `danger`→`red`, `dangerSoft`→`redFill`, `xs`→`caption`, `sm`→`subheadline`, `md`→`body`, `lg`→`title3`, `xl`→`title2`, `xxl`→`title1`, `display`/`hero`→`largeTitle`, `radius.lg`→`radius.sheet`, `radius.xl`→`radius.bubble`, `variant="primary"`→`"filled"`, `variant="ghost"`→`"plain"`, `variant="danger"`→`"destructive"` — and rerun until it exits 0.

- [ ] **Step 8: Full verification**

Run: `npm test --workspace @hbm/mobile`

Run: `npx tsc -p apps/mobile/tsconfig.json --noEmit`

Run: `npm run lint --workspace @hbm/mobile`

Run: `npm test` (repo root, confirms the backend suite is untouched)

Expected: all exit 0.

- [ ] **Step 9: Manual QA pass**

Run: `cd apps/mobile && npx expo run:ios`

Walk the checklist:
- Each of the five tabs shows a 34pt title that collapses into the bar on scroll, with content visible through the blur.
- Settings drill-downs keep the tab bar and show an inline title.
- Switch the simulator to dark mode (Features > Toggle Appearance) and re-walk all five tabs plus two detail pages: backgrounds go pure black, cards `#1C1C1E`, and every label stays legible.
- Today's checklist toggles and submits; Plan's generate action sits in the header and its 409 guidance still shows as the neutral "还差一步" banner; Coach's composer clears the keyboard and the tab bar.
- Enable VoiceOver: every checklist row announces pending/completed/skipped state; disabled rows and controls announce disabled; the three Coach header actions have distinct labels.
- Set Dynamic Type to the largest accessibility size: rows grow beyond their minimum heights, form labels stack above inputs, segmented labels remain readable, and no action is clipped.
- Enable Reduce Transparency: the tab bar becomes opaque. Enable Increase Contrast and verify normal body text plus filled/destructive control labels remain legible in both appearances.
- Measure the Plan and Coach header actions: each exposes at least a 44×44pt touch target even though the glyph is smaller.

- [ ] **Step 10: Commit**

```bash
git add -A apps/mobile
git commit -m "refactor(mobile): drop the Quiet Health compatibility layer"
```

---

## Self-Review

**Spec coverage.** The three requests map to tasks as follows. "More Apple native" is Tasks 1 (system colours and SF Pro type), 4 (native large titles and standard push behaviour), 5 (translucent system-height tab bar), and 10 (native chat header, iOS bubbles). "More card effects, e.g. checklists" is Tasks 2 (the grouped-card primitives), 6 (hero card, focus card, and the checklist card specifically), 7, 8, 9 (every settings group), and 10 (memory cards). "Top and bottom bars take too much area" is Tasks 3 (`Screen` stops adding its own safe area and fixed 32pt bottom pad, and the tab bar height now drives the bottom inset), 4 (177pt of fixed top chrome becomes 155pt that collapses to 103pt), 5 (68pt hardcoded bar becomes the 49pt system bar with content scrolling under it), and 10 (coach's 195pt header becomes 103pt).

**Placeholder scan.** Every code step carries the actual code. The one instruction expressed as a rule rather than nine copies is the `Section`→`InsetGroup` / `HairlineRow`→`Row` conversion in Task 9 Step 5; it is stated as an exact four-part mechanical mapping with per-file notes for all six remaining pages, and Step 3 and Step 4 show the full conversion for three of the nine files.

**Type consistency.** `CheckStatus` is defined in Task 2 and consumed in Task 6, including the VoiceOver `"mixed"` mapping for skipped state. `SEPARATOR_INSET` is defined and exported in Task 2 and asserted in its own test. `useNativeHeaderOptions` is created in Task 4 and consumed by all five tab layouts plus Task 10, using the non-deprecated `headerLargeTitleEnabled` option from the directly declared native-stack package. `BottomTabBarHeightContext` is introduced in Task 3 (with the dependency declared in the same task) and reused in Task 10. Text-bearing green/red surfaces use the Task 1 `control*` / `destructive*` pairs; decorative rings may still use `tintFill`. Token and text-style names used in Tasks 6 through 10 all exist in the Task 1 definitions, and the legacy names those tasks still touch are exactly the aliases Task 1 provides and Task 11 removes.

## Risks

- **Large titles need the scroll view to cooperate.** `headerLargeTitleEnabled` only collapses when the screen's `ScrollView` sets `contentInsetAdjustmentBehavior="automatic"` (Task 3) and is the stack's primary scrollable. Coach has nested scroll views, so it deliberately uses an inline title.
- **Task 5 needs a native rebuild.** `expo-blur` ships native code; a Metro reload will not pick it up.
- **Pure black dark mode.** The current dark background is a greenish `#1f2a24`; moving to `#000000` and `#1C1C1E` changes every contrast assumption, which is why Task 11 Step 9 walks dark mode explicitly.
- **Palette snapshots are not UIKit dynamic colours.** Fixed values keep Android/web deterministic but do not automatically follow Increase Contrast; accessible control pairs and the manual contrast pass are therefore required.
- **Relative Expo Router paths are document-relative by default.** Settings uses absolute `/(app)/(tabs)/settings/<detail>` destinations and Task 4 verifies every destination in the simulator.
- **`useBottomTabBarHeight` would crash the auth screens.** They render outside the tab navigator, so `Screen` reads `BottomTabBarHeightContext` directly and falls back to the safe-area inset.
- **Wide renames.** Roughly 250 `tokens.*` and 69 `size=` call sites move. Both are typed (`ThemeTokens`, `keyof typeof textStyles`), so Task 11 Step 7 turns any straggler into a compile error rather than a silent visual regression.
