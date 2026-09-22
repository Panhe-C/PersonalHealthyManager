# Personal iPhone Stage 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run Healthy Body Manager on the owner's physical iPhone over the same network, backed by the existing Mac-hosted Next.js API and SQLite database.

**Architecture:** The mobile client resolves its API origin from `EXPO_PUBLIC_API_BASE_URL`, falling back to Expo config only for simulator development. The Mac backend binds to all network interfaces, while a small checked-in preflight tool discovers reachable LAN addresses and treats an authenticated endpoint's `401` response as proof that the backend is healthy.

**Tech Stack:** Expo 52, React Native 0.76, TypeScript, Vitest, Node.js, Next.js 15, Prisma, SQLite

## Global Constraints

- Do not expose the backend directly to the public internet.
- Do not commit a machine-specific IP address, personal credentials, or secrets.
- Keep SQLite as the only database for Stage 1.
- Preserve the current dirty worktree and stage only files named by this plan.
- Do not claim physical-device success until the owner's real iPhone loads authenticated backend data.
- Stage 1 covers same-network access only; Tailscale, launch-at-login, backups, and signed standalone builds remain Stage 2.

---

## File Structure

- Create `apps/mobile/src/config/apiBaseUrl.ts`: pure API-origin validation and normalization.
- Create `apps/mobile/src/config/apiBaseUrl.test.ts`: behavior tests for runtime override, fallback, normalization, and invalid input.
- Modify `apps/mobile/src/api/client.ts`: consume the validated API origin.
- Create `scripts/phone-preflight.mjs`: LAN-address discovery and authenticated-endpoint reachability probe.
- Create `tests/scripts/phonePreflight.test.ts`: tests for address discovery and probe status handling.
- Modify `package.json`: add phone-backend and preflight scripts.
- Modify `apps/mobile/package.json`: add an explicit Expo LAN script.
- Create `apps/mobile/.env.example`: document the required non-loopback API origin.
- Modify `apps/mobile/README.md`: replace stale scaffold guidance with the physical-iPhone workflow.
- Create locally but do not commit `apps/mobile/.env.local`: current Mac LAN API origin used for the live run.

---

### Task 1: Runtime API Base URL Resolution

**Files:**
- Create: `apps/mobile/src/config/apiBaseUrl.ts`
- Create: `apps/mobile/src/config/apiBaseUrl.test.ts`
- Modify: `apps/mobile/src/api/client.ts:1-6`

**Interfaces:**
- Consumes: `process.env.EXPO_PUBLIC_API_BASE_URL` and `Constants.expoConfig?.extra?.apiBaseUrl`.
- Produces: `resolveApiBaseUrl(runtimeUrl?: string, configuredUrl?: string): string`.

- [ ] **Step 1: Write the failing resolver tests**

```ts
import { describe, expect, it } from "vitest";
import { resolveApiBaseUrl } from "./apiBaseUrl";

describe("resolveApiBaseUrl", () => {
  it("prefers the Expo public runtime URL and removes trailing slashes", () => {
    expect(resolveApiBaseUrl(" http://192.168.1.20:3000/ ", "http://localhost:3000"))
      .toBe("http://192.168.1.20:3000");
  });

  it("falls back to the Expo config URL for simulator development", () => {
    expect(resolveApiBaseUrl(undefined, "http://localhost:3000"))
      .toBe("http://localhost:3000");
  });

  it.each(["", "localhost:3000", "ftp://192.168.1.20"])(
    "rejects an unusable API origin: %s",
    (value) => {
      expect(() => resolveApiBaseUrl(value, undefined)).toThrow("Mobile API base URL");
    }
  );
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npm test --workspace @hbm/mobile -- src/config/apiBaseUrl.test.ts
```

Expected: FAIL because `./apiBaseUrl` does not exist.

- [ ] **Step 3: Implement the minimal resolver**

```ts
export function resolveApiBaseUrl(runtimeUrl?: string, configuredUrl?: string): string {
  const candidate = runtimeUrl?.trim() || configuredUrl?.trim();
  if (!candidate) {
    throw new Error("Mobile API base URL is not configured.");
  }

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error("Mobile API base URL must be an absolute HTTP(S) URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Mobile API base URL must use HTTP or HTTPS.");
  }

  return url.origin;
}
```

- [ ] **Step 4: Run the resolver tests and verify GREEN**

Run:

```bash
npm test --workspace @hbm/mobile -- src/config/apiBaseUrl.test.ts
```

Expected: 1 test file and 5 cases pass.

- [ ] **Step 5: Wire the resolver into the API client**

Replace the direct `Constants` fallback in `apps/mobile/src/api/client.ts` with:

```ts
import Constants from "expo-constants";
import { z } from "zod";
import { getAccessToken, getRefreshToken, setTokens, resetTokens } from "../auth/tokenStore";
import { resolveApiBaseUrl } from "../config/apiBaseUrl";

const API_BASE_URL = resolveApiBaseUrl(
  process.env.EXPO_PUBLIC_API_BASE_URL,
  Constants.expoConfig?.extra?.apiBaseUrl as string | undefined
);
const V1 = `${API_BASE_URL}/api/v1`;
```

- [ ] **Step 6: Run mobile client tests and type checking**

Run:

```bash
npm test --workspace @hbm/mobile -- src/config/apiBaseUrl.test.ts src/api/client.test.ts
./node_modules/.bin/tsc --noEmit -p apps/mobile/tsconfig.json
```

Expected: both test files pass and TypeScript exits 0.

- [ ] **Step 7: Commit Task 1**

```bash
git add apps/mobile/src/config/apiBaseUrl.ts apps/mobile/src/config/apiBaseUrl.test.ts apps/mobile/src/api/client.ts
git commit -m "feat: configure mobile API origin at runtime"
```

---

### Task 2: Phone Backend Preflight

**Files:**
- Create: `scripts/phone-preflight.mjs`
- Create: `tests/scripts/phonePreflight.test.ts`

**Interfaces:**
- Consumes: Node `os.networkInterfaces()`, an optional CLI API origin, and `fetch`.
- Produces: `collectLanIpv4(interfaces): string[]`, `profileProbeUrl(baseUrl): string`, and `probeBackend(baseUrl, fetchImpl): Promise<number>`.

- [ ] **Step 1: Write failing preflight tests**

```ts
import { describe, expect, it, vi } from "vitest";
import { collectLanIpv4, probeBackend, profileProbeUrl } from "../../scripts/phone-preflight.mjs";

describe("phone preflight", () => {
  it("returns external IPv4 addresses and ignores loopback", () => {
    expect(collectLanIpv4({
      lo0: [{ address: "127.0.0.1", family: "IPv4", internal: true }],
      en0: [{ address: "192.168.1.20", family: "IPv4", internal: false }],
      utun0: [{ address: "10.0.0.2", family: 4, internal: false }]
    })).toEqual(["192.168.1.20", "10.0.0.2"]);
  });

  it("probes the authenticated profile endpoint", () => {
    expect(profileProbeUrl("http://192.168.1.20:3000/"))
      .toBe("http://192.168.1.20:3000/api/v1/profile");
  });

  it.each([200, 401])("treats HTTP %s as a reachable backend", async (status) => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status }));
    await expect(probeBackend("http://192.168.1.20:3000", fetchImpl)).resolves.toBe(status);
  });

  it("rejects an unexpected backend status", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 503 }));
    await expect(probeBackend("http://192.168.1.20:3000", fetchImpl))
      .rejects.toThrow("HTTP 503");
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npm test -- tests/scripts/phonePreflight.test.ts
```

Expected: FAIL because `scripts/phone-preflight.mjs` does not exist.

- [ ] **Step 3: Implement the preflight module and CLI**

```js
import os from "node:os";
import { pathToFileURL } from "node:url";

export function collectLanIpv4(interfaces) {
  return Object.values(interfaces)
    .flatMap((entries) => entries ?? [])
    .filter((entry) => (entry.family === "IPv4" || entry.family === 4) && !entry.internal)
    .map((entry) => entry.address);
}

export function profileProbeUrl(baseUrl) {
  return new URL("/api/v1/profile", baseUrl).toString();
}

export async function probeBackend(baseUrl, fetchImpl = fetch) {
  const response = await fetchImpl(profileProbeUrl(baseUrl), { redirect: "manual" });
  if (response.ok || response.status === 401) return response.status;
  throw new Error(`Backend probe failed with HTTP ${response.status}.`);
}

async function main() {
  const addresses = collectLanIpv4(os.networkInterfaces());
  const requested = process.argv[2];

  if (!requested) {
    if (addresses.length === 0) throw new Error("No external IPv4 address was found.");
    console.log("Candidate iPhone API origins:");
    for (const address of addresses) console.log(`  http://${address}:3000`);
    console.log("Run again with one origin to verify it.");
    return;
  }

  const status = await probeBackend(requested);
  console.log(`Backend reachable at ${requested} (HTTP ${status}).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
```

- [ ] **Step 4: Run the preflight tests and verify GREEN**

Run:

```bash
npm test -- tests/scripts/phonePreflight.test.ts
```

Expected: 1 file and 5 cases pass.

- [ ] **Step 5: Run the CLI without a backend**

Run:

```bash
node scripts/phone-preflight.mjs
```

Expected: prints one or more candidate `http://<address>:3000` origins and exits 0.

- [ ] **Step 6: Commit Task 2**

```bash
git add scripts/phone-preflight.mjs tests/scripts/phonePreflight.test.ts
git commit -m "feat: add iPhone backend preflight"
```

---

### Task 3: Phone Mode Commands and Documentation

**Files:**
- Modify: `package.json`
- Modify: `apps/mobile/package.json`
- Create: `apps/mobile/.env.example`
- Modify: `apps/mobile/README.md`

**Interfaces:**
- Consumes: `EXPO_PUBLIC_API_BASE_URL` in `apps/mobile/.env.local`.
- Produces: `npm run dev:phone`, `npm run phone:check -- <origin>`, and `npm run start:phone --workspace @hbm/mobile`.

- [ ] **Step 1: Add root phone scripts**

Add to the root `scripts` object:

```json
"dev:phone": "NODE_ENV=development next dev --hostname 0.0.0.0 --port 3000",
"phone:check": "node scripts/phone-preflight.mjs"
```

- [ ] **Step 2: Add the Expo LAN script**

Add to `apps/mobile/package.json`:

```json
"start:phone": "expo start --lan"
```

- [ ] **Step 3: Add the committed mobile environment example**

Create `apps/mobile/.env.example`:

```dotenv
# Use the Mac address printed by `npm run phone:check`.
# Do not use localhost on a physical iPhone.
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.20:3000
```

- [ ] **Step 4: Replace stale mobile README setup guidance**

Document this exact Stage 1 workflow:

```bash
# Terminal 1, repo root
npm run dev:phone

# Terminal 2, repo root
npm run phone:check
npm run phone:check -- http://<mac-lan-ip>:3000

# One-time local configuration; do not commit this file
cp apps/mobile/.env.example apps/mobile/.env.local
# Edit apps/mobile/.env.local with the verified Mac address.

# Terminal 3, repo root
npm run start:phone --workspace @hbm/mobile
```

The README must also state:

- Mac and iPhone must use the same network.
- iPhone must grant Local Network permission to Expo Go.
- The backend must remain running.
- A `401` from `/api/v1/profile` is a healthy unauthenticated result.
- Stage 1 is not complete until a physical iPhone logs in and loads API-backed data.

- [ ] **Step 5: Validate config and documentation**

Run:

```bash
node -e 'const root=require("./package.json"); const mobile=require("./apps/mobile/package.json"); if(!root.scripts["dev:phone"] || !root.scripts["phone:check"] || !mobile.scripts["start:phone"]) process.exit(1)'
git diff --check -- package.json apps/mobile/package.json apps/mobile/.env.example apps/mobile/README.md
```

Expected: both commands exit 0.

- [ ] **Step 6: Commit Task 3**

```bash
git add package.json apps/mobile/package.json apps/mobile/.env.example apps/mobile/README.md
git commit -m "docs: add physical iPhone LAN workflow"
```

---

### Task 4: Automated Regression Verification

**Files:**
- No production files added.

**Interfaces:**
- Consumes all Stage 1 changes.
- Produces evidence that existing Web, backend, and mobile behavior remains green.

- [ ] **Step 1: Run the complete mobile test suite**

Run:

```bash
npm test --workspace @hbm/mobile
```

Expected: all mobile test files pass.

- [ ] **Step 2: Run mobile TypeScript checking**

Run:

```bash
./node_modules/.bin/tsc --noEmit -p apps/mobile/tsconfig.json
```

Expected: exits 0 with no type errors.

- [ ] **Step 3: Run the complete root test suite**

Run:

```bash
npm test
```

Expected: all root test files pass.

- [ ] **Step 4: Run the production Web build**

Run:

```bash
npm run build
```

Expected: Next.js compiles, type-checks, and generates all routes successfully.

- [ ] **Step 5: Inspect the scoped diff**

Run:

```bash
git status --short
git diff HEAD~3 -- apps/mobile/src/config/apiBaseUrl.ts apps/mobile/src/config/apiBaseUrl.test.ts apps/mobile/src/api/client.ts scripts/phone-preflight.mjs tests/scripts/phonePreflight.test.ts package.json apps/mobile/package.json apps/mobile/.env.example apps/mobile/README.md
```

Expected: only planned task files appear in the Stage 1 diff; pre-existing user changes remain untouched.

---

### Task 5: Live Same-Network iPhone Verification

**Files:**
- Create locally, ignored: `apps/mobile/.env.local`
- No committed source changes expected.

**Interfaces:**
- Consumes the verified Mac LAN origin and an iPhone on the same network.
- Produces physical-device evidence for Stage 1 acceptance.

- [ ] **Step 1: Start the backend in phone mode**

Run in a persistent terminal session:

```bash
npm run dev:phone
```

Expected: Next.js reports ready on port 3000 and listens on `0.0.0.0`.

- [ ] **Step 2: Discover and verify the Mac LAN origin**

Run:

```bash
npm run phone:check
npm run phone:check -- http://<selected-address>:3000
```

Expected: the selected origin returns HTTP 401 or 200 and is reported reachable.

- [ ] **Step 3: Create the ignored local mobile environment**

Create `apps/mobile/.env.local` from the example and replace the example address:

```dotenv
EXPO_PUBLIC_API_BASE_URL=http://<selected-address>:3000
```

Confirm it is ignored:

```bash
git check-ignore apps/mobile/.env.local
```

Expected: prints `apps/mobile/.env.local`.

- [ ] **Step 4: Start Expo for the physical iPhone**

Run in a persistent terminal session:

```bash
npm run start:phone --workspace @hbm/mobile
```

Expected: Expo reports LAN mode and displays a QR code.

- [ ] **Step 5: Request the user's interactive device action**

The user must:

1. Put the iPhone on the same network as the Mac.
2. Open Expo Go and scan the displayed QR code.
3. Allow Local Network access when iOS prompts.
4. Report the first visible screen or any Expo compatibility error.

Stop here until the user confirms the real device loaded the app.

- [ ] **Step 6: Verify the authenticated user journey on the real iPhone**

On the physical iPhone:

1. Log in with the owner's account.
2. Confirm Today loads from `/api/v1/today`.
3. Confirm Plan loads and a task can be opened.
4. Confirm Insights loads activities, sleep, and recovery.
5. Confirm Coach loads conversations and sends a message.
6. Confirm Settings loads profile and goals.
7. Background and reopen the app to confirm stored tokens restore the session.

Expected: all five tabs render API-backed data without a network or schema error.

- [ ] **Step 7: Record acceptance without overstating success**

Report:

- The exact Mac origin used, without committing it.
- The backend and Expo session state.
- Each tab's pass/fail result.
- Any remaining device-only defect.

Stage 1 is complete only after Step 6 passes on the owner's physical iPhone.
