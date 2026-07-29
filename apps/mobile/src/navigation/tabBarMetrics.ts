/**
 * Vertical space screens must reserve at the bottom so content clears the
 * floating capsule tab bar: capsule (~52pt) + 16pt float offset + 20pt FAB
 * overlap + breathing room. The capsule is absolutely positioned, so
 * BottomTabBarHeightContext cannot measure it reliably; Screen uses this
 * explicit constant whenever it renders inside the tab navigator, and
 * FloatingTabBar (Task 3) is the layout it reserves space for.
 */
export const FLOATING_TAB_BAR_CLEARANCE = 110;
