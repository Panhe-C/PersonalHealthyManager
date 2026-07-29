/* eslint-disable import/first -- component imports must follow Vitest module mocks */
import { describe, expect, it, vi } from "vitest";

const captured = vi.hoisted(() => ({ scrollViewProps: null as Record<string, unknown> | null }));

vi.mock("react-native", () => ({
  ScrollView: (props: Record<string, unknown>) => {
    captured.scrollViewProps = props;
    return null;
  },
  StyleSheet: {
    create: (styles: unknown) => styles,
    hairlineWidth: 0.5
  },
  useColorScheme: () => "light"
}));

vi.mock("@react-navigation/bottom-tabs", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  return { BottomTabBarHeightContext: React.createContext<number | undefined>(undefined) };
});

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 59, bottom: 34, left: 0, right: 0 })
}));

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BottomTabBarHeightContext } from "@react-navigation/bottom-tabs";
import { FLOATING_TAB_BAR_CLEARANCE } from "../navigation/tabBarMetrics";
import { spacing } from "../theme/tokens";
import { Screen } from "./Screen";

function flatten(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) return Object.assign({}, ...style.map(flatten));
  return (style ?? {}) as Record<string, unknown>;
}

function renderScreen(tabBarHeight: number | undefined) {
  captured.scrollViewProps = null;
  const screen = createElement(Screen, null);
  renderToStaticMarkup(
    tabBarHeight === undefined
      ? screen
      : createElement(BottomTabBarHeightContext.Provider, { value: tabBarHeight }, screen)
  );
  const props = captured.scrollViewProps as Record<string, unknown> | null;
  return flatten(props?.contentContainerStyle);
}

describe("Screen", () => {
  it("clears the floating capsule plus the safe-area inset inside the tab navigator", () => {
    // Home-indicator iPhones: capsule top sits at insets.bottom + 108, so the
    // pad must include insets.bottom on top of the fixed clearance.
    expect(renderScreen(80).paddingBottom).toBe(34 + FLOATING_TAB_BAR_CLEARANCE);
  });

  it("falls back to the safe-area inset plus breathing room outside the tab navigator", () => {
    expect(renderScreen(undefined).paddingBottom).toBe(34 + spacing.xl);
  });
});
