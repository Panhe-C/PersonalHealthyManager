/**
 * Vertical space screens must reserve at the bottom so content clears the
 * floating capsule tab bar. The capsule is 72pt tall (44pt tab slot +
 * 2×14pt vertical padding) and docked 16pt above the safe-area inset, and
 * the FAB overhangs it by another 20pt, so the FAB's top edge sits at
 * insets.bottom + 108 — 110 covers that worst case with breathing room.
 * The capsule is absolutely positioned, so BottomTabBarHeightContext cannot
 * measure it reliably; Screen uses this explicit constant whenever it
 * renders inside the tab navigator and adds insets.bottom on top of it,
 * and FloatingTabBar (Task 3) is the layout it reserves space for.
 */
export const FLOATING_TAB_BAR_CLEARANCE = 110;
