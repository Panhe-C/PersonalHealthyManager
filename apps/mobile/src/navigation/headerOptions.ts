import type { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { useTheme } from "../theme/tokens";

/**
 * Shared native-stack header options for the five tab stacks.
 * `headerLargeTitleEnabled` gives iOS collapse-on-scroll: the title starts at
 * 34pt and shrinks into the 44pt bar as the user scrolls.
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
