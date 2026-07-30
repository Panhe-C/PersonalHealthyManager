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

import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { FloatingTabBar } from "./FloatingTabBar";

type Node = {
  type?: unknown;
  props?: {
    accessibilityLabel?: string;
    accessibilityRole?: string;
    accessibilityState?: { selected?: boolean };
    onPress?: () => void;
    style?: unknown;
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
  it("renders the five tabs as equal slots with Chinese labels", () => {
    const tree = FloatingTabBar(makeProps().props);

    expect(buttons(tree).map((button) => button.props?.accessibilityLabel)).toEqual([
      "今日",
      "计划",
      "教练",
      "数据",
      "我的"
    ]);
    for (const button of buttons(tree)) {
      expect(button.props?.accessibilityRole).toBe("button");
    }
  });

  it("marks only the focused tab selected", () => {
    const { props } = makeProps();
    const focusedProps = {
      ...props,
      state: { ...props.state, index: 2 }
    } as unknown as BottomTabBarProps;

    expect(buttons(FloatingTabBar(focusedProps)).map((button) => button.props?.accessibilityState)).toEqual([
      { selected: false },
      { selected: false },
      { selected: true },
      { selected: false },
      { selected: false }
    ]);
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

  it("treats coach as an ordinary tab", () => {
    const { navigation, props } = makeProps();
    const [, , coach] = buttons(FloatingTabBar(props));

    coach.props?.onPress?.();

    expect(navigation.emit).toHaveBeenCalledWith({
      type: "tabPress",
      target: "coach-key",
      canPreventDefault: true
    });
    expect(navigation.navigate).toHaveBeenCalledWith("coach", undefined);
  });
});
