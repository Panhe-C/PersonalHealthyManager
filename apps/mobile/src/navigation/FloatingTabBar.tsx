import { Pressable, StyleSheet, View } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { cardShadow, radius, useTheme } from "../theme/tokens";

/**
 * Warm floating capsule tab bar. Rendered through the bottom-tabs `tabBar`
 * render prop so the navigator keeps its five-route state, screen options,
 * and deep links untouched. All five tabs are equal slots in the capsule.
 * The bar is absolutely positioned above the home indicator; screens clear
 * it via FLOATING_TAB_BAR_CLEARANCE (Screen.tsx). No blur is involved, so
 * Reduce Transparency needs no special handling.
 */
export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { tokens, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const shadow = cardShadow(isDark ? "dark" : "light");

  return (
    <View pointerEvents="box-none" style={[styles.dock, { bottom: insets.bottom + 16 }]}>
      <View style={[styles.capsule, { backgroundColor: tokens.surface }, shadow]}>
        {state.routes.map((route, index) => {
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
  tabSlot: { alignItems: "center", flex: 1, justifyContent: "center", minHeight: 44 }
});
