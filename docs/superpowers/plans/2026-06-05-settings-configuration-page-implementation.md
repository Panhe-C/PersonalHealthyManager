# Settings Configuration Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Settings page where authenticated users can save encrypted model provider credentials, configure data MCP descriptors, and test model/data connectivity.

**Architecture:** Add a user-scoped `UserSettings` table, isolate settings defaults/crypto/service logic under `src/settings`, expose authenticated settings APIs, and render a client Settings form inside the existing dashboard shell. API keys are encrypted server-side and never returned to the client.

**Tech Stack:** Next.js App Router, React 19, Prisma/SQLite, Node `crypto`, Vitest, Testing Library, lucide-react, CSS.

---

## File Structure

Create:

```text
app/(dashboard)/settings/page.tsx
app/api/settings/route.ts
app/api/settings/test/route.ts
components/SettingsForm.tsx
src/settings/crypto.ts
src/settings/defaults.ts
src/settings/service.ts
tests/components/SettingsForm.test.tsx
tests/settings/crypto.test.ts
tests/settings/service.test.ts
prisma/migrations/20260605090000_user_settings/migration.sql
```

Modify:

```text
.env.example
app/globals.css
components/AppNavigation.tsx
prisma/schema.prisma
tests/components/AppNavigation.test.tsx
```

Responsibilities:

- `src/settings/crypto.ts`: encryption key parsing, encrypt/decrypt, API key hinting.
- `src/settings/defaults.ts`: provider list, default model settings, default data MCP connections.
- `src/settings/service.ts`: validation, DB mapping, save/load behavior, and test orchestration.
- `components/SettingsForm.tsx`: form state, save action, individual tests, and run-all tests.
- API routes: authentication wrapper and JSON request/response boundaries.

---

### Task 1: Add User Settings Schema

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260605090000_user_settings/migration.sql`
- Modify: `.env.example`

- [ ] **Step 1: Add the Prisma relation and model**

Add `settings UserSettings?` to `model User`.

Add this model after `AgentMessage`:

```prisma
model UserSettings {
  id                     String   @id @default(cuid())
  userId                 String   @unique
  modelProvider          String   @default("openai")
  modelName              String   @default("gpt-4o-mini")
  modelBaseUrl           String?
  encryptedApiKey        String?
  apiKeyIv               String?
  apiKeyTag              String?
  apiKeyHint             String?
  dataMcpConnectionsJson String
  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

- [ ] **Step 2: Add migration SQL**

Create `prisma/migrations/20260605090000_user_settings/migration.sql`:

```sql
CREATE TABLE "UserSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "modelProvider" TEXT NOT NULL DEFAULT 'openai',
    "modelName" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    "modelBaseUrl" TEXT,
    "encryptedApiKey" TEXT,
    "apiKeyIv" TEXT,
    "apiKeyTag" TEXT,
    "apiKeyHint" TEXT,
    "dataMcpConnectionsJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");
```

- [ ] **Step 3: Document the encryption environment variable**

Append to `.env.example`:

```env
SETTINGS_ENCRYPTION_KEY="development-settings-key-32byte!"
```

- [ ] **Step 4: Generate Prisma client**

Run:

```bash
npm run prisma:generate
```

Expected: Prisma client generation succeeds.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260605090000_user_settings/migration.sql .env.example
git commit -m "feat: add user settings schema"
```

---

### Task 2: Add Settings Defaults and Encryption

**Files:**
- Create: `src/settings/defaults.ts`
- Create: `src/settings/crypto.ts`
- Create: `tests/settings/crypto.test.ts`

- [ ] **Step 1: Write encryption tests**

Create `tests/settings/crypto.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decryptApiKey, encryptApiKey, maskApiKey } from "@/src/settings/crypto";

const previousKey = process.env.SETTINGS_ENCRYPTION_KEY;

describe("settings crypto", () => {
  beforeEach(() => {
    process.env.SETTINGS_ENCRYPTION_KEY = "12345678901234567890123456789012";
  });

  afterEach(() => {
    if (previousKey === undefined) {
      delete process.env.SETTINGS_ENCRYPTION_KEY;
    } else {
      process.env.SETTINGS_ENCRYPTION_KEY = previousKey;
    }
  });

  it("encrypts and decrypts an API key without exposing plaintext in storage", () => {
    const encrypted = encryptApiKey("sk-test-123456");

    expect(encrypted.encryptedApiKey).not.toContain("sk-test");
    expect(decryptApiKey(encrypted)).toBe("sk-test-123456");
  });

  it("returns a short non-sensitive key hint", () => {
    expect(maskApiKey("sk-test-123456")).toBe("sk-...3456");
    expect(maskApiKey("plain-secret")).toBe("...cret");
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
npm test -- tests/settings/crypto.test.ts
```

Expected: FAIL because `@/src/settings/crypto` does not exist.

- [ ] **Step 3: Implement defaults**

Create `src/settings/defaults.ts`:

```ts
export type ModelProvider = "openai" | "anthropic" | "custom";

export type DataMcpConnectionId = "coros" | "calendar" | "meal_menu";

export type DataMcpConnection = {
  id: DataMcpConnectionId;
  label: string;
  enabled: boolean;
  serverName: string;
  capabilityName: string;
  endpoint: string;
  notes: string;
};

export type SettingsView = {
  modelProvider: ModelProvider;
  modelName: string;
  modelBaseUrl: string;
  hasApiKey: boolean;
  apiKeyHint: string | null;
  dataMcpConnections: DataMcpConnection[];
};

export const modelProviders: Array<{ value: ModelProvider; label: string; defaultModel: string; defaultBaseUrl: string }> = [
  { value: "openai", label: "OpenAI", defaultModel: "gpt-4o-mini", defaultBaseUrl: "https://api.openai.com/v1" },
  { value: "anthropic", label: "Anthropic", defaultModel: "claude-3-5-haiku-latest", defaultBaseUrl: "https://api.anthropic.com/v1" },
  { value: "custom", label: "Custom", defaultModel: "custom-model", defaultBaseUrl: "" }
];

export const defaultDataMcpConnections: DataMcpConnection[] = [
  {
    id: "coros",
    label: "COROS",
    enabled: true,
    serverName: "coros",
    capabilityName: "daily-health",
    endpoint: "",
    notes: "Workout, sleep, HRV, recovery, and training load."
  },
  {
    id: "calendar",
    label: "Calendar",
    enabled: true,
    serverName: "calendar",
    capabilityName: "agenda",
    endpoint: "",
    notes: "Schedule, free windows, and training event drafts."
  },
  {
    id: "meal_menu",
    label: "Meal Menu",
    enabled: true,
    serverName: "meal-menu",
    capabilityName: "today-menu",
    endpoint: "",
    notes: "Daily breakfast, lunch, dinner, and nutrition choices."
  }
];

export const defaultSettingsView: SettingsView = {
  modelProvider: "openai",
  modelName: "gpt-4o-mini",
  modelBaseUrl: "https://api.openai.com/v1",
  hasApiKey: false,
  apiKeyHint: null,
  dataMcpConnections: defaultDataMcpConnections
};
```

- [ ] **Step 4: Implement encryption helpers**

Create `src/settings/crypto.ts`:

```ts
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type EncryptedApiKey = {
  encryptedApiKey: string;
  apiKeyIv: string;
  apiKeyTag: string;
  apiKeyHint: string;
};

function parseEncryptionKey() {
  const configured = process.env.SETTINGS_ENCRYPTION_KEY;
  if (configured) {
    const base64 = Buffer.from(configured, "base64");
    if (base64.length === 32) return base64;

    const raw = Buffer.from(configured);
    if (raw.length === 32) return raw;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("SETTINGS_ENCRYPTION_KEY must be configured in production");
  }

  return Buffer.from("dev-settings-key-32-bytes-local!");
}

export function maskApiKey(apiKey: string) {
  const trimmed = apiKey.trim();
  const suffix = trimmed.slice(-4);
  if (trimmed.startsWith("sk-")) return `sk-...${suffix}`;
  return `...${suffix}`;
}

export function encryptApiKey(apiKey: string): EncryptedApiKey {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", parseEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(apiKey, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    encryptedApiKey: encrypted.toString("base64"),
    apiKeyIv: iv.toString("base64"),
    apiKeyTag: tag.toString("base64"),
    apiKeyHint: maskApiKey(apiKey)
  };
}

export function decryptApiKey(input: { encryptedApiKey: string; apiKeyIv: string; apiKeyTag: string }) {
  const decipher = createDecipheriv("aes-256-gcm", parseEncryptionKey(), Buffer.from(input.apiKeyIv, "base64"));
  decipher.setAuthTag(Buffer.from(input.apiKeyTag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(input.encryptedApiKey, "base64")), decipher.final()]).toString("utf8");
}
```

- [ ] **Step 5: Run encryption test**

Run:

```bash
npm test -- tests/settings/crypto.test.ts
```

Expected: 2 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/settings/defaults.ts src/settings/crypto.ts tests/settings/crypto.test.ts
git commit -m "feat: add encrypted settings helpers"
```

---

### Task 3: Add Settings Service and API Tests

**Files:**
- Create: `src/settings/service.ts`
- Create: `tests/settings/service.test.ts`

- [ ] **Step 1: Write service tests**

Create `tests/settings/service.test.ts` with mocked Prisma and fetch coverage for save/load/test behavior:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/src/db/client";
import { loadUserSettings, saveUserSettings, testUserSettings } from "@/src/settings/service";

vi.mock("@/src/db/client", () => ({
  prisma: {
    userSettings: {
      findUnique: vi.fn(),
      upsert: vi.fn()
    }
  }
}));

describe("settings service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("SETTINGS_ENCRYPTION_KEY", "12345678901234567890123456789012");
    vi.stubGlobal("fetch", vi.fn());
  });

  it("returns default settings when a user has not saved settings", async () => {
    vi.mocked(prisma.userSettings.findUnique).mockResolvedValue(null);

    const settings = await loadUserSettings("user-1");

    expect(settings.modelProvider).toBe("openai");
    expect(settings.hasApiKey).toBe(false);
    expect(settings.dataMcpConnections).toHaveLength(3);
  });

  it("preserves the existing API key when a save request leaves apiKey blank", async () => {
    vi.mocked(prisma.userSettings.findUnique).mockResolvedValue({
      encryptedApiKey: "encrypted",
      apiKeyIv: "iv",
      apiKeyTag: "tag",
      apiKeyHint: "sk-...1234"
    } as never);
    vi.mocked(prisma.userSettings.upsert).mockResolvedValue({} as never);

    await saveUserSettings("user-1", {
      modelProvider: "openai",
      modelName: "gpt-4o-mini",
      modelBaseUrl: "https://api.openai.com/v1",
      apiKey: "",
      dataMcpConnections: [
        { id: "coros", label: "COROS", enabled: true, serverName: "coros", capabilityName: "daily-health", endpoint: "", notes: "" }
      ]
    });

    expect(prisma.userSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          encryptedApiKey: "encrypted",
          apiKeyHint: "sk-...1234"
        })
      })
    );
  });

  it("reports model as not configured when no key is saved", async () => {
    vi.mocked(prisma.userSettings.findUnique).mockResolvedValue(null);

    const results = await testUserSettings("user-1", "model");

    expect(results).toEqual([
      expect.objectContaining({
        id: "model",
        status: "not_configured"
      })
    ]);
  });

  it("reports enabled MCP descriptors as connected without endpoint network checks", async () => {
    vi.mocked(prisma.userSettings.findUnique).mockResolvedValue(null);

    const results = await testUserSettings("user-1", "coros");

    expect(results).toEqual([
      expect.objectContaining({
        id: "coros",
        status: "connected"
      })
    ]);
  });
});
```

- [ ] **Step 2: Run failing service tests**

Run:

```bash
npm test -- tests/settings/service.test.ts
```

Expected: FAIL because `@/src/settings/service` does not exist.

- [ ] **Step 3: Implement the service**

Create `src/settings/service.ts` with:

- `loadUserSettings(userId)`
- `saveUserSettings(userId, input)`
- `testUserSettings(userId, target)`
- local validation helpers for provider, URLs, and MCP connection payloads
- model tests using provider-specific `fetch`
- data MCP tests using descriptor readiness plus optional endpoint `GET`

- [ ] **Step 4: Run service tests**

Run:

```bash
npm test -- tests/settings/service.test.ts tests/settings/crypto.test.ts
```

Expected: all settings tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/settings/service.ts tests/settings/service.test.ts
git commit -m "feat: add settings service"
```

---

### Task 4: Add Settings API Routes

**Files:**
- Create: `app/api/settings/route.ts`
- Create: `app/api/settings/test/route.ts`
- Create: `tests/api/settings.test.ts`

- [ ] **Step 1: Write API tests**

Create `tests/api/settings.test.ts` that mocks `withUser` and service methods:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/settings/route";
import { POST as TEST_POST } from "@/app/api/settings/test/route";
import { loadUserSettings, saveUserSettings, testUserSettings } from "@/src/settings/service";

vi.mock("@/src/auth/api", () => ({
  withUser:
    (handler: (...args: unknown[]) => Promise<Response>) =>
    (request: Request) =>
      handler({ id: "user-1", timezone: "Asia/Shanghai" }, request)
}));

vi.mock("@/src/settings/service", () => ({
  loadUserSettings: vi.fn(),
  saveUserSettings: vi.fn(),
  testUserSettings: vi.fn()
}));

describe("settings API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads settings for the authenticated user", async () => {
    vi.mocked(loadUserSettings).mockResolvedValue({ modelProvider: "openai", modelName: "gpt-4o-mini", modelBaseUrl: "", hasApiKey: false, apiKeyHint: null, dataMcpConnections: [] });

    const response = await GET(new Request("http://localhost/api/settings"));

    expect(await response.json()).toEqual(expect.objectContaining({ modelProvider: "openai" }));
    expect(loadUserSettings).toHaveBeenCalledWith("user-1");
  });

  it("saves settings and returns the sanitized view", async () => {
    vi.mocked(saveUserSettings).mockResolvedValue({ modelProvider: "openai", modelName: "gpt-4o-mini", modelBaseUrl: "", hasApiKey: true, apiKeyHint: "sk-...1234", dataMcpConnections: [] });

    const response = await POST(new Request("http://localhost/api/settings", { method: "POST", body: JSON.stringify({ modelProvider: "openai" }) }));

    expect(response.status).toBe(200);
    expect(await response.json()).not.toHaveProperty("apiKey");
  });

  it("runs settings tests for a requested target", async () => {
    vi.mocked(testUserSettings).mockResolvedValue([{ id: "model", label: "Model", status: "not_configured", message: "Missing API key", latencyMs: null }]);

    const response = await TEST_POST(new Request("http://localhost/api/settings/test", { method: "POST", body: JSON.stringify({ target: "model" }) }));

    expect(await response.json()).toEqual({ results: [expect.objectContaining({ id: "model" })] });
  });
});
```

- [ ] **Step 2: Run failing API tests**

Run:

```bash
npm test -- tests/api/settings.test.ts
```

Expected: FAIL because API routes do not exist.

- [ ] **Step 3: Implement API routes**

Create `app/api/settings/route.ts`:

```ts
import { NextResponse } from "next/server";
import { withUser } from "@/src/auth/api";
import { loadUserSettings, saveUserSettings } from "@/src/settings/service";

export const GET = withUser(async (user) => NextResponse.json(await loadUserSettings(user.id)));

export const POST = withUser(async (user, request: Request) => {
  try {
    return NextResponse.json(await saveUserSettings(user.id, await request.json()));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Settings could not be saved" }, { status: 400 });
  }
});
```

Create `app/api/settings/test/route.ts`:

```ts
import { NextResponse } from "next/server";
import { withUser } from "@/src/auth/api";
import { testUserSettings } from "@/src/settings/service";

export const POST = withUser(async (user, request: Request) => {
  try {
    const body = await request.json();
    return NextResponse.json({ results: await testUserSettings(user.id, body.target) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Settings test failed" }, { status: 400 });
  }
});
```

- [ ] **Step 4: Run API tests**

Run:

```bash
npm test -- tests/api/settings.test.ts tests/settings/service.test.ts tests/settings/crypto.test.ts
```

Expected: settings API and service tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/api/settings/route.ts app/api/settings/test/route.ts tests/api/settings.test.ts
git commit -m "feat: add settings APIs"
```

---

### Task 5: Add Settings Navigation and Page UI

**Files:**
- Modify: `components/AppNavigation.tsx`
- Modify: `tests/components/AppNavigation.test.tsx`
- Create: `app/(dashboard)/settings/page.tsx`
- Create: `components/SettingsForm.tsx`
- Create: `tests/components/SettingsForm.test.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Extend navigation test**

Update `tests/components/AppNavigation.test.tsx` so the mocked pathname is `/settings` and assert `Settings` has `aria-current="page"`.

- [ ] **Step 2: Run failing navigation test**

Run:

```bash
npm test -- tests/components/AppNavigation.test.tsx
```

Expected: FAIL because Settings nav item is missing.

- [ ] **Step 3: Add Settings nav item**

Update `components/AppNavigation.tsx` to import `SlidersHorizontal` from `lucide-react` and add:

```ts
{ href: "/settings", label: "Settings", icon: SlidersHorizontal }
```

- [ ] **Step 4: Write SettingsForm component test**

Create `tests/components/SettingsForm.test.tsx` to render saved masked key state and verify `Run all tests` calls `/api/settings/test`.

- [ ] **Step 5: Implement Settings page and form**

Create `app/(dashboard)/settings/page.tsx` that loads settings with `loadUserSettings(user.id)` and renders `SettingsForm`.

Create `components/SettingsForm.tsx` as a client component with:

- controlled model/provider/base URL inputs
- blank password API key input
- connection cards for every data MCP source
- `Save settings`
- individual `Test` buttons
- `Run all tests`
- inline success/error/test result messages

- [ ] **Step 6: Add CSS**

Add compact Settings styles to `app/globals.css`:

- `.settings-grid`
- `.settings-panel`
- `.connection-grid`
- `.connection-card`
- `.settings-status-line`
- `.test-result-list`
- `.test-result`

Use existing tokens, 8px radii, and responsive single-column layout below 820px.

- [ ] **Step 7: Run component tests**

Run:

```bash
npm test -- tests/components/AppNavigation.test.tsx tests/components/SettingsForm.test.tsx
```

Expected: both component tests pass.

- [ ] **Step 8: Commit**

```bash
git add components/AppNavigation.tsx tests/components/AppNavigation.test.tsx app/\\(dashboard\\)/settings/page.tsx components/SettingsForm.tsx tests/components/SettingsForm.test.tsx app/globals.css
git commit -m "feat: add settings page"
```

---

### Task 6: Verify Build, Migrate Local DB, and Browser Test

**Files:**
- No planned code changes

- [ ] **Step 1: Run full automated verification**

Run:

```bash
npm test
npm run build
git diff --check
```

Expected: all tests pass, build succeeds, and diff check has no output.

- [ ] **Step 2: Prepare worktree local environment**

Copy root `.env` into the worktree if it is missing, then add a non-production `SETTINGS_ENCRYPTION_KEY` to the worktree `.env` only:

```env
SETTINGS_ENCRYPTION_KEY="development-settings-key-32byte!"
```

Do not commit `.env`.

- [ ] **Step 3: Apply migration to local SQLite DB**

Run:

```bash
npm run prisma:migrate
```

Expected: migration applies and Prisma client remains generated.

- [ ] **Step 4: Start a local preview server**

Run either:

```bash
npm run dev -- --hostname 127.0.0.1 --port 3002
```

or, if the dev server is unstable in this environment:

```bash
npm run build
npm run start -- --hostname 127.0.0.1 --port 3002
```

- [ ] **Step 5: Browser verification**

Open `/settings` in the in-app browser and verify:

- Settings navigation is active.
- Model runtime form renders with masked key state.
- Saving settings works.
- Blank API key preserves saved key.
- `Test model`, individual MCP tests, and `Run all tests` show readable statuses.
- The full API key is not displayed after save.
- Mobile width keeps controls usable without overflow.

- [ ] **Step 6: Commit any verification-only fixes**

If browser verification reveals a small UI bug, fix it, rerun focused tests plus build, and commit:

```bash
git add app/globals.css components/SettingsForm.tsx app/\(dashboard\)/settings/page.tsx app/api/settings/route.ts app/api/settings/test/route.ts src/settings/service.ts
git commit -m "fix: polish settings verification"
```

---

### Task 7: Final Review and Branch Completion

**Files:**
- No planned code changes

- [ ] **Step 1: Final verification from a clean worktree**

Run:

```bash
npm test
npm run build
git diff --check
git status --short
```

Expected:

- Tests pass.
- Build succeeds.
- Diff check has no output.
- Status is clean.

- [ ] **Step 2: Review against spec**

Use `docs/superpowers/specs/2026-06-05-settings-configuration-page-design.md` as the checklist. Confirm every requirement is implemented or explicitly out of scope.

- [ ] **Step 3: Complete the development branch**

Use `superpowers:finishing-a-development-branch` and ask whether to merge locally, push, keep branch, or discard.
