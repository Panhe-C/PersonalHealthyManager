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
