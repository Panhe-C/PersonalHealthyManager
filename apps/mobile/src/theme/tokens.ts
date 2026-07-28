import { useColorScheme } from "react-native";

export const lightTokens = {
  bg: "#F6F4EE",
  panel: "#FBFAF6",
  panelSoft: "#F0EEE7",
  ink: "#243129",
  inkStrong: "#17231D",
  muted: "#718077",
  line: "#D9D7CF",
  lineStrong: "#BEBFB7",
  sage: "#718579",
  sageStrong: "#52685C",
  sageSoft: "#E3E8E1",
  clay: "#C87958",
  claySoft: "#F2E2DA",
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
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22
} as const;

export const opacity = {
  pressed: 0.72,
  disabled: 0.5
} as const;

export const typography = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
  display: 36,
  hero: 44,
  metric: 56
} as const;

export type ThemeTokens = { [K in keyof typeof lightTokens]: string };

export function useTheme(): { tokens: ThemeTokens; isDark: boolean } {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  return { tokens: isDark ? darkTokens : lightTokens, isDark };
}
