import { useColorScheme } from "react-native";

// Approximated from app/globals.css (oklch → hex) so the RN app visually echoes
// the Web design system. RN doesn't reliably support oklch, so we use hex.
export const lightTokens = {
  bg: "#f3f6f1",
  panel: "#fdfefc",
  panelSoft: "#eef2ec",
  ink: "#2b3530",
  inkStrong: "#1f2925",
  muted: "#6b7670",
  line: "#dde3dc",
  lineStrong: "#c4ccc2",
  sage: "#5a8a6b",
  sageStrong: "#3f6b52",
  sageSoft: "#e8efdf",
  blue: "#4a78a8",
  blueSoft: "#e8eef4",
  clay: "#b07a4a",
  claySoft: "#f1e6d8",
  danger: "#b3413f",
  dangerSoft: "#f1e0df"
} as const;

export const darkTokens = {
  bg: "#1f2a24",
  panel: "#28332c",
  panelSoft: "#324039",
  ink: "#d6ddd9",
  inkStrong: "#eef2ef",
  muted: "#9ba8a0",
  line: "#44524a",
  lineStrong: "#5a6a60",
  sage: "#7dbd8f",
  sageStrong: "#a0d6af",
  sageSoft: "#3a4a3f",
  blue: "#7ba3d0",
  blueSoft: "#3a4a52",
  clay: "#c79866",
  claySoft: "#4a3d2f",
  danger: "#d36464",
  dangerSoft: "#4a2f2f"
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32
} as const;

export const radius = {
  sm: 12,
  md: 16,
  lg: 22,
  xl: 30
} as const;

export const typography = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
  display: 34
} as const;

export type ThemeTokens = typeof lightTokens;

export function useTheme(): { tokens: ThemeTokens; isDark: boolean } {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  return { tokens: isDark ? darkTokens : lightTokens, isDark };
}
