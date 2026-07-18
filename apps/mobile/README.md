# @hbm/mobile

iOS client for Healthy Body Manager, built with Expo and React Native.

## Physical iPhone: same-network Stage 1

This workflow runs the API and SQLite database on the Mac while the iPhone connects over the same local network.

Prerequisites:

- Mac and iPhone are connected to the same network.
- Expo Go is installed on the iPhone.
- The repository dependencies are installed with `npm install`.
- The backend `.env` and Prisma SQLite database are configured.

### 1. Start the backend for phone access

From the repository root:

```bash
npm run dev:phone
```

Keep this terminal running. Unlike `npm run dev`, this command listens on all Mac network interfaces at port 3000.

### 2. Find and verify the Mac address

In a second terminal:

```bash
npm run phone:check
npm run phone:check -- http://<mac-lan-ip>:3000
```

The first command prints candidate addresses. Use the address belonging to the network shared with the iPhone. The second command verifies the backend. HTTP `401` from `/api/v1/profile` is expected and healthy because the probe is not logged in.

### 3. Configure the mobile API origin

Create the ignored local environment file:

```bash
cp apps/mobile/.env.example apps/mobile/.env.local
```

Edit it with the verified address:

```dotenv
EXPO_PUBLIC_API_BASE_URL=http://<mac-lan-ip>:3000
```

Do not use `localhost`: on a physical iPhone, `localhost` means the iPhone itself. Do not commit `.env.local`.

### 4. Start Expo in LAN mode

In a third terminal, from the repository root:

```bash
npm run start:phone --workspace @hbm/mobile
```

Open Expo Go on the iPhone and scan the QR code. Grant Local Network access if iOS prompts for it. The backend and Expo terminals must remain running while using the development build.

Stage 1 is complete only after the physical iPhone logs in and loads API-backed data in Today, Plan, Insights, Coach, and Settings.

## Simulator development

For an iOS simulator, the fallback API origin in `app.json` remains `http://localhost:3000`:

```bash
npm run dev
npm run ios --workspace @hbm/mobile
```

## Mobile architecture

- `app/_layout.tsx`: Query client, authentication provider, and route guard.
- `app/(auth)/login.tsx`: email/password login.
- `app/(app)/(tabs)`: Today, Plan, Insights, Coach, and Settings tabs.
- `src/api/client.ts`: Bearer authentication, single-flight refresh, and response validation.
- `src/auth/tokenStore.ts`: SecureStore-backed access and refresh tokens.
- `src/config/apiBaseUrl.ts`: validated runtime API-origin resolution.
