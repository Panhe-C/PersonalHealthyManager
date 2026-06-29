# @hbm/mobile

iOS App client for Healthy Body Manager (Expo + React Native + expo-router).

This is the M1 skeleton described in `docs/superpowers/specs/2026-06-29-ios-app-m1-client-skeleton-plan.md`. It is a **scaffold**: the file structure, navigation, auth flow, API client (Bearer + 401 auto-refresh + single-flight), and design-token底座 are in place, but the npm dependencies are **not yet installed** and the app has not been run on a simulator/device in this session.

## Run it (first time)

```bash
# from repo root — workspaces include apps/mobile + packages/contracts
npm install

# point the app at your local backend (defaults to http://localhost:3000)
# edit app.json -> expo.extra.apiBaseUrl, or set EXPO_PUBLIC_API_BASE_URL

cd apps/mobile
npx expo start            # press i for iOS simulator
```

Prerequisites: Expo CLI (comes with `expo`), Xcode + iOS simulator, and the backend running (`npm run dev` from repo root). An Apple Developer account is **not** required for M1 simulator work — only for M4/M5 device + TestFlight.

## What's here

- `app/_layout.tsx` — root: QueryClientProvider + AuthProvider + route guard by `status`.
- `app/(auth)/login.tsx` — email/password → `signIn` → token persisted in SecureStore.
- `app/(app)/_layout.tsx` — redirects to login when not authed.
- `app/(app)/(tabs)/_layout.tsx` — 5 tabs: 今日 / 计划 / 数据 / 教练 / 我的.
- `src/api/client.ts` — fetch wrapper: injects `Authorization: Bearer`, on 401 refreshes via `/api/auth/refresh` (single-flight), replays the original request, zod-validates responses, maps `{ error, code }` to `ApiError`.
- `src/auth/tokenStore.ts` — SecureStore-backed token persistence with in-memory mirror.
- `src/auth/AuthContext.tsx` — `useAuth()` exposing `status / signIn / signOut`.
- `src/theme/tokens.ts` — design tokens approximated from `app/globals.css` (light/dark).
- `src/components/*` — minimal `Screen / Text / Button / Card / Spinner` set.

The 今日 tab calls `useProfileQuery()` (`GET /api/v1/profile`) as the M1 "真实数据探针" — it proves the Bearer + auto-refresh chain works end-to-end against the M0 backend.

## Known gaps / next steps (M2+)

- Tab screens beyond 今日 are placeholders (M2 今日/计划/打卡, M3 看板/Agent/目标).
- No tests yet — add RN Testing Library tests for `client.ts` (401 auto-refresh + single-flight) and `AuthContext` once deps are installed.
- `assets/icon.png` + `assets/splash.png` referenced by `app.json` are not committed — drop in real assets before EAS Build (M4/M5).
- HealthKit / push / background sync / deep link / MCP OAuth are M4/M5.
