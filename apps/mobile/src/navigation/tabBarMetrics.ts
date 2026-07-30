/**
 * Vertical space screens must reserve at the bottom so content clears the
 * floating capsule tab bar. The capsule is 72pt tall (44pt tab slot +
 * 2×14pt vertical padding) and docked 16pt above the safe-area inset, so
 * its top edge sits at insets.bottom + 88 — 110 covers that with breathing
 * room. The capsule is absolutely positioned, so BottomTabBarHeightContext
 * cannot measure it reliably; Screen uses this explicit constant whenever
 * it renders inside the tab navigator and adds insets.bottom on top of it,
 * and FloatingTabBar is the layout it reserves space for.
 */
export const FLOATING_TAB_BAR_CLEARANCE = 110;
