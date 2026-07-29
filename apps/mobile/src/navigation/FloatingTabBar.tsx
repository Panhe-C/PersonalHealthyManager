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
