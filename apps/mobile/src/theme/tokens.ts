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

type BaseTokens = { [K in keyof typeof lightBase]: string };

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
