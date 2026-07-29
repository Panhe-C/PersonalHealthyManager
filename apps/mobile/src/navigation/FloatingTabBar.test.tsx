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

function flatten(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) return Object.assign({}, ...style.map(flatten));
  return (style ?? {}) as Record<string, unknown>;
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

  it("sends the FAB to the coach tab as the placeholder action", () => {
    const { navigation, props } = makeProps();
    const fab = buttons(FloatingTabBar(props)).find(
      (button) => button.props?.accessibilityLabel === "快速记录"
    );

    fab?.props?.onPress?.();

    expect(navigation.navigate).toHaveBeenCalledWith("coach", undefined);
  });

  it("marks the FAB selected and tinted while the coach tab is focused", () => {
    const { props } = makeProps();
    const focusedProps = {
      ...props,
      state: { ...props.state, index: 2 }
    } as unknown as BottomTabBarProps;
    const fab = buttons(FloatingTabBar(focusedProps)).find(
      (button) => button.props?.accessibilityLabel === "快速记录"
    );

    expect(fab?.props?.accessibilityState).toEqual({ selected: true });
    expect(flatten(fab?.props?.style).backgroundColor).toBe("#3D7A55");
  });

  it("keeps the FAB unselected and dark on the other tabs", () => {
    const fab = buttons(FloatingTabBar(makeProps().props)).find(
      (button) => button.props?.accessibilityLabel === "快速记录"
    );

    expect(fab?.props?.accessibilityState).toEqual({ selected: false });
    expect(flatten(fab?.props?.style).backgroundColor).toBe("#22221F");
  });
});
