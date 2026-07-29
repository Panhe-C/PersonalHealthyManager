# Warm Card Redesign — Phase 1 Design (Today tab + capsule tab bar)

**Status:** approved direction, pending implementation plan
**Date:** 2026-07-29
**Source of truth:** throwaway branch `prototype/warm-today-variants` (commit `0772148`), variant B with the compacted hero card, confirmed by the user in the simulator.

## Context

The app just completed an iOS-native redesign (branch `codex/mobile-ios-native-redesign`, Tasks 1–11). The user then supplied a visual reference (soft warm-neutral project-management UI) and chose to **replace** that direction entirely. Three prototype variants were built on a throwaway route; **variant B ("health dashboard") won**, with one adjustment: the hero readiness-ring card was compacted from a tall centered layout to a horizontal ring-left / metrics-right layout.

This spec covers **phase 1 only**: the design tokens, the shared primitives the Today page touches, the Today tab itself, and the floating capsule tab bar. Later phases (Plan, Insights, Coach, Settings tree, auth screens) reuse the same tokens and primitives but are out of scope here.

## Non-goals

- Restyling Plan / Insights / Coach / Settings / auth screens (phase 2+).
- Giving the tab-bar FAB its real action. Phase 1 wires it to navigate to the Coach tab as a placeholder.
- Custom fonts. System font (SF Pro on iOS) with explicit weights only.
- Deleting the iOS-era primitives that other tabs still use (`InsetGroup`, `Row`, `CheckRow` stay; they get restyled, not removed).

## Design tokens (`apps/mobile/src/theme/tokens.ts`)

Warm neutral palette, light and dark, replacing the iOS snapshots **in place** (same key names, so all ~existing call sites keep compiling; untouched tabs render half-migrated until their phase — accepted):

| Key | Light | Dark |
|---|---|---|
| `bg` | `#EFEEE9` | `#1A1917` |
| `surface` (card) | `#FBFBF7` | `#252421` |
| `label` | `#1C1C1A` | `#F2F1EC` |
| `labelSecondary` | `#8B8B83` | `#8B8B83` |
| `labelTertiary` | `#8B8B83` at 60% | `#8B8B83` at 60% |
| `separator` | `#D8D6CE` | `#3A3934` |
| `separatorOpaque` | `#D8D6CE` | `#3A3934` |
| `tint` (text-safe) | `#3D7A55` | `#5FA97E` |
| `tintFill` | `#4C9A6B` | `#5FA97E` |
| `controlFill` | `#22221F` | `#F2F1EC` |
| `controlLabel` | `#FBFBF7` | `#1C1C1A` |
| `fill` (track) | `#E3E1D9` | `#33322E` |
| `red` | `#C4534A` | `#D96A60` |
| `redFill` | `rgba(196,83,74,0.12)` | `rgba(217,106,96,0.18)` |
| `destructiveFill` | `#A8463E` | `#D96A60` |
| `destructiveLabel` | `#FBFBF7` | `#1C1C1A` |
| `orange` (new key) | `#E8823A` | `#E8914F` |

- `radius.card`: 10 → **28**; `radius.sheet` 16 → **32**; `radius.bubble` stays 20; add `radius.pill = 999`.
- New export `cardShadow(scheme)`: `shadowColor #6B675C / #000000`, opacity 0.14, radius 24, offset (0, 10), elevation 4. Shadows are now a sanctioned part of the visual language (the "no decorative shadows" rule from the iOS plan is revoked).
- Text styles: unchanged keys and metrics. Headings on the Today page use `weight: "700"` explicitly; no new text styles needed.
- `orange` is added to `ThemeTokens`; all other keys keep their names.

## Shared primitives (restyle, signatures unchanged)

- `Button`: `filled`/`destructive` become pills (`borderRadius: 999`, `controlFill`/`controlLabel`); fix the Task-3 deviations at the same time: use `opacity.pressed` (0.72) / `opacity.disabled` (0.5) from tokens and `marginHorizontal: 16`.
- `CheckRow`: keep structure; completed checkbox uses `tint`, border uses `separator`.
- `InsetGroup` / `Row`: `radius.card` picks up 28 automatically; `InsetGroup` gains the card shadow. No API changes.

## Tab bar (`app/(app)/(tabs)/_layout.tsx`)

Replace the translucent system tab bar with a **custom floating capsule** rendered via the `tabBar` option:

- White (`surface`) capsule, `borderRadius: 999`, card shadow, absolute at `insets.bottom + 16`, horizontal margin 20.
- Five tabs in the existing order (今日、计划、教练、数据、我的), icon-only, active = `controlFill` glyph, inactive = `labelSecondary`.
- Center-raised circular FAB (`controlFill`, 60pt, overlapping the capsule's top edge by 20pt, plus icon in `controlLabel`). Phase-1 action: navigate to the Coach tab.
- Icons per tab stay as today (Sun/Calendar/MessageSquare/BarChart2/Settings equivalents).
- Reduce Transparency: no-op (no blur involved anymore). VoiceOver: every tab button and the FAB get `accessibilityRole="button"` + Chinese labels; FAB label 快速记录.

## Today tab (`app/(app)/(tabs)/today/index.tsx`)

Layout follows prototype variant B (compacted), wired to the existing real data hooks (readiness, metrics, checklist, `nextChecklistStatus` mutation, `TextField` 实际负荷 + submit `Button` all preserved):

1. **In-page header** (native large-title header is hidden for this tab only, `headerShown: false`): date overline (e.g. `7月29日 · 周二`) + `今日` (30pt, weight 700), trailing circular `surface` button with calendar icon → links to the Plan tab. Safe-area top inset applied manually.
2. **Hero card** (surface, radius 32, shadow, horizontal): left = SVG readiness ring 116pt / stroke 10 (`track` + `tint` arc, value + 准备状态 in center); vertical hairline; right = three metric rows (睡眠 / 恢复 / 活动), label left `labelSecondary`, value right weight 700, hairlines between rows.
3. **本周睡眠 bar card**: icon tile (moon in `fill` tile) + title + right meta (平均), 7 rounded bars (Mon–Sun), latest bar `controlFill`, others `fill`.
4. **训练清单 card**: icon tile + title + progress meta (`1/3`); `CheckRow` rows with hairlines; then the existing 实际负荷 `TextField` + submit `Button` (pill).
5. Cards spaced 16pt, horizontal margin 20. `Screen` keeps `contentInsetAdjustmentBehavior` (harmless without the native header) but the bottom pad must clear the floating capsule (~110pt) instead of the old tab-bar height — `Screen` gains an optional `bottomClearance` prop defaulting to the capsule footprint when inside the tab navigator.

## Tests

- `src/iosUi.test.ts` is renamed `src/warmUi.test.ts` and rewritten: asserts the new palette values, `radius.card: 28`, `radius.pill`, the card shadow export, the pill `Button` (`borderRadius: 999`, token-driven opacities), the custom `tabBar` in the tabs layout, and the Today's in-page header (`headerShown: false`).
- Component tests for `InsetGroup`/`Row`/`CheckRow` keep passing (signatures unchanged; update only assertions that bake in old colors/radii).
- Acceptance per task: `npm test --workspace @hbm/mobile`, `npx tsc -p apps/mobile/tsconfig.json --noEmit`, `npm run lint --workspace @hbm/mobile` all green; repo-root `npm test` untouched.

## Out-of-scope leftovers acknowledged

After phase 1, the other four tabs render the warm palette with iOS-era layouts (large titles, inset groups) — visually mixed but functional. Phase 2 specs will cover them.

## Risks

- **Custom tab bar** must preserve the existing five-route navigation state and badges exactly; use `@react-navigation/bottom-tabs` `tabBar` render prop rather than replacing the navigator.
- **Dark mode is an inversion of the reference** (no source); the values above were derived during prototyping and need one simulator pass in dark mode.
- **Hiding the native header on Today only** means the other tabs still show iOS large titles — intentional during transition, flagged here so it isn't "fixed" by accident.
