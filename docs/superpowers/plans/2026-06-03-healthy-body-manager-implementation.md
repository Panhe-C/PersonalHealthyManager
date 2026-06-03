# Healthy Body Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first-version Healthy Body Manager product shell with login, body profile, goals, normalized provider imports, planning engine, daily checklist loop, mock menu recommendations, calendar draft confirmation, and an Agent conversation surface.

**Architecture:** Use a Next.js App Router application with TypeScript, Prisma, and SQLite. Keep business rules in standalone `src/domain` and `src/planning` modules, keep external data behind provider normalizers, and let the Web App and API routes consume the same service layer.

**Tech Stack:** Next.js, React, TypeScript, Prisma, SQLite, Vitest, Testing Library, Zod, Node crypto, lucide-react.

---

## File Structure

Create this repository structure:

```text
app/
  (auth)/login/page.tsx
  (dashboard)/layout.tsx
  (dashboard)/profile/page.tsx
  (dashboard)/goals/page.tsx
  (dashboard)/plan/page.tsx
  (dashboard)/agent/page.tsx
  api/agent/route.ts
  api/auth/login/route.ts
  api/auth/logout/route.ts
  api/calendar/drafts/[id]/confirm/route.ts
  api/calendar/drafts/route.ts
  api/goals/route.ts
  api/plan/generate/route.ts
  api/profile/route.ts
  api/sync/calendar/route.ts
  api/sync/coros/route.ts
  api/training/tasks/[id]/completion/route.ts
  globals.css
  layout.tsx
  page.tsx
components/
  ActionButton.tsx
  AgentPanel.tsx
  CalendarDraftList.tsx
  Checklist.tsx
  GoalForm.tsx
  GeneratePlanButton.tsx
  MetricCard.tsx
  NutritionPanel.tsx
  ProfileForm.tsx
  WeeklyPlan.tsx
prisma/
  schema.prisma
scripts/
  seed.ts
src/
  auth/password.ts
  auth/session.ts
  db/client.ts
  domain/models.ts
  domain/validation.ts
  providers/calendar.ts
  providers/coros.ts
  providers/meal-menu.ts
  planning/calendarDrafts.ts
  planning/checklist.ts
  planning/engine.ts
  planning/nutrition.ts
  services/agent.ts
  services/calendarDraftService.ts
  services/checklistService.ts
  services/goalService.ts
  services/planService.ts
  services/profileService.ts
  services/syncService.ts
  test/factories.ts
  test/setup.ts
tests/
  auth/password.test.ts
  providers/calendar.test.ts
  providers/coros.test.ts
  providers/meal-menu.test.ts
  planning/calendarDrafts.test.ts
  planning/checklist.test.ts
  planning/engine.test.ts
  planning/nutrition.test.ts
  services/agent.test.ts
  services/checklistService.test.ts
  services/goalService.test.ts
  services/profileService.test.ts
.env.example
.gitignore
next.config.ts
package.json
tsconfig.json
vitest.config.ts
```

Each file has one clear responsibility:

- `src/domain/*`: shared types and validation.
- `src/providers/*`: normalize external provider payloads into internal models.
- `src/planning/*`: deterministic planning, nutrition, checklist, and calendar draft rules.
- `src/services/*`: persistence and API-facing orchestration.
- `app/api/*`: HTTP route handlers.
- `app/(dashboard)/*` and `components/*`: user-facing Web App.

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`
- Create: `.env.example`
- Create: `.gitignore`
- Create: `app/layout.tsx`
- Create: `app/page.tsx`
- Create: `app/globals.css`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "healthy-body-manager",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run --passWithNoTests",
    "test:watch": "vitest",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "seed": "tsx scripts/seed.ts"
  },
  "dependencies": {
    "@prisma/client": "^6.0.0",
    "clsx": "^2.1.1",
    "lucide-react": "^0.468.0",
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.0",
    "@testing-library/react": "^16.1.0",
    "@types/node": "^22.10.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "eslint": "^9.16.0",
    "eslint-config-next": "^15.0.0",
    "jsdom": "^25.0.1",
    "prisma": "^6.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create TypeScript and test config**

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "es2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

`next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    typedRoutes: true
  }
};

export default nextConfig;
```

`vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      reporter: ["text", "html"]
    }
  },
  resolve: {
    alias: {
      "@": new URL(".", import.meta.url).pathname
    }
  }
});
```

`src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 3: Create environment and ignore files**

`.env.example`:

```bash
DATABASE_URL="file:./dev.db"
SESSION_SECRET="development-secret-32-bytes-long-2026"
```

`.gitignore`:

```gitignore
node_modules
.next
dist
coverage
.env
.env.local
dev.db
dev.db-journal
*.log
```

- [ ] **Step 4: Create the initial app shell**

`app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Healthy Body Manager",
  description: "Personal training, recovery, and nutrition planning"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

`app/page.tsx`:

```tsx
import { redirect } from "next/navigation";

export default function HomePage() {
  redirect("/plan");
}
```

`app/globals.css`:

```css
:root {
  color-scheme: light;
  --bg: #f7f8f5;
  --panel: #ffffff;
  --ink: #1e2420;
  --muted: #667066;
  --line: #dfe5dd;
  --accent: #24745a;
  --accent-strong: #174c3c;
  --warn: #9c5b18;
  --danger: #9b2c2c;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font-family: Arial, Helvetica, sans-serif;
}

a {
  color: inherit;
  text-decoration: none;
}

button,
input,
select,
textarea {
  font: inherit;
}

.page {
  max-width: 1180px;
  margin: 0 auto;
  padding: 24px;
}

.surface {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 8px;
}
```

- [ ] **Step 5: Install dependencies and run baseline checks**

Run:

```bash
npm install
npm test
npm run build
```

Expected:

- `npm install` completes and creates `package-lock.json`.
- `npm test` reports no test files or an empty successful suite.
- `npm run build` compiles the basic Next.js app.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.json next.config.ts vitest.config.ts src/test/setup.ts .env.example .gitignore app/layout.tsx app/page.tsx app/globals.css
git commit -m "chore: scaffold next app"
```

---

### Task 2: Prisma Schema And Database Client

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/db/client.ts`

- [ ] **Step 1: Create Prisma schema**

`prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  timezone     String   @default("Asia/Shanghai")
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  sessions       Session[]
  bodyProfile    BodyProfile?
  goals          Goal[]
  activityRecords ActivityRecord[]
  sleepRecords   SleepRecord[]
  recoveryRecords RecoveryRecord[]
  calendarSnapshots CalendarSnapshot[]
  mealMenus      MealMenu[]
  plans          Plan[]
  calendarDrafts CalendarEventDraft[]
  agentMessages  AgentMessage[]
}

model Session {
  id        String   @id @default(cuid())
  tokenHash String   @unique
  userId    String
  expiresAt DateTime
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model BodyProfile {
  id                  String   @id @default(cuid())
  userId              String   @unique
  heightCm            Float
  weightKg            Float
  bodyFatPercent      Float?
  birthday            DateTime?
  sex                 String
  restingHeartRateBpm Int?
  trainingExperience  String
  injuriesJson            String
  dietaryPreferencesJson  String
  trainingPreferencesJson String
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Goal {
  id          String   @id @default(cuid())
  userId      String
  title       String
  type        String
  priority    Int
  status      String   @default("active")
  targetDate  DateTime?
  metricsJson String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model ActivityRecord {
  id              String   @id @default(cuid())
  userId          String
  source          String
  sourceId        String?
  sportType       String
  startedAt       DateTime
  endedAt         DateTime
  durationMinutes Int
  distanceKm      Float?
  averagePaceSecPerKm Int?
  averageSpeedKph Float?
  averageHeartRateBpm Int?
  calories        Int?
  trainingLoad    Float?
  intensity       String
  metadataJson    String
  createdAt       DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, startedAt])
}

model SleepRecord {
  id             String   @id @default(cuid())
  userId         String
  source         String
  date           DateTime
  sleepStart     DateTime?
  sleepEnd       DateTime?
  durationMinutes Int
  qualityScore   Int?
  metadataJson    String
  createdAt      DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, date])
}

model RecoveryRecord {
  id                    String   @id @default(cuid())
  userId                String
  source                String
  date                  DateTime
  recoveryPercent       Int?
  hrvMs                 Float?
  restingHeartRateBpm   Int?
  stressLevel           Int?
  trainingLoadShortTerm Float?
  trainingLoadLongTerm  Float?
  metadataJson          String
  createdAt             DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, date])
}

model CalendarSnapshot {
  id          String   @id @default(cuid())
  userId      String
  source      String
  rangeStart  DateTime
  rangeEnd    DateTime
  busyWindowsJson     String
  freeWindowsJson     String
  importantEventsJson String
  capturedAt  DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, rangeStart, rangeEnd])
}

model MealMenu {
  id        String   @id @default(cuid())
  userId    String
  source    String
  date      DateTime
  meal      String
  itemsJson String
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, date])
}

model Plan {
  id               String   @id @default(cuid())
  userId           String
  weekStart        DateTime
  weekEnd          DateTime
  status           String   @default("draft")
  summary          String
  trainingLoadGoal Float?
  nutritionTargetsJson    String
  menuRecommendationsJson String
  explanation      String
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  trainingTasks TrainingTask[]
  adjustments   PlanAdjustment[]
  calendarDrafts CalendarEventDraft[]

  @@index([userId, weekStart, weekEnd])
}

model TrainingTask {
  id                  String   @id @default(cuid())
  planId              String
  userId              String
  date                DateTime
  title               String
  trainingType        String
  durationMinutes     Int
  intensity           String
  targetJson          String
  scheduledStart      DateTime?
  scheduledEnd        DateTime?
  goalId              String?
  status              String   @default("planned")
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  plan Plan @relation(fields: [planId], references: [id], onDelete: Cascade)
  checklistItems TrainingChecklistItem[]
  completion TrainingCompletion?
  calendarDraft CalendarEventDraft?

  @@index([userId, date])
}

model TrainingChecklistItem {
  id        String   @id @default(cuid())
  taskId    String
  label     String
  order     Int
  required  Boolean  @default(true)
  status    String   @default("pending")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  task TrainingTask @relation(fields: [taskId], references: [id], onDelete: Cascade)
}

model TrainingCompletion {
  id             String   @id @default(cuid())
  taskId          String   @unique
  userId          String
  status          String
  perceivedEffort String?
  notes           String?
  linkedActivityId String?
  plannedVsActualJson String
  completedAt     DateTime @default(now())

  task TrainingTask @relation(fields: [taskId], references: [id], onDelete: Cascade)
}

model PlanAdjustment {
  id          String   @id @default(cuid())
  planId      String
  userId      String
  trigger     String
  previousStateJson String
  newStateJson      String
  reason      String
  explanation String
  createdAt   DateTime @default(now())

  plan Plan @relation(fields: [planId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt])
}

model CalendarEventDraft {
  id              String   @id @default(cuid())
  userId          String
  planId          String?
  trainingTaskId  String?  @unique
  title           String
  startsAt        DateTime
  endsAt          DateTime
  notes           String
  status          String   @default("draft")
  externalEventId String?
  failureReason   String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  plan Plan? @relation(fields: [planId], references: [id], onDelete: SetNull)
  trainingTask TrainingTask? @relation(fields: [trainingTaskId], references: [id], onDelete: SetNull)

  @@index([userId, startsAt])
}

model AgentMessage {
  id        String   @id @default(cuid())
  userId    String
  role      String
  content   String
  metadataJson String
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt])
}
```

- [ ] **Step 2: Create Prisma client**

`src/db/client.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

- [ ] **Step 3: Run schema validation and migration**

Run:

```bash
npm run prisma:generate
npm run prisma:migrate -- --name init
```

Expected:

- Prisma client is generated.
- A migration is created under `prisma/migrations`.
- SQLite database is created when `DATABASE_URL` is configured.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/db/client.ts
git commit -m "feat: add database schema"
```

---

### Task 3: Domain Types And Provider Normalizers

**Files:**
- Create: `src/domain/models.ts`
- Create: `src/domain/validation.ts`
- Create: `src/providers/coros.ts`
- Create: `src/providers/calendar.ts`
- Create: `src/providers/meal-menu.ts`
- Create: `tests/providers/coros.test.ts`
- Create: `tests/providers/calendar.test.ts`
- Create: `tests/providers/meal-menu.test.ts`

- [ ] **Step 1: Write failing provider tests**

`tests/providers/coros.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { normalizeCorosActivity, normalizeCorosRecovery, normalizeCorosSleep } from "@/src/providers/coros";

describe("COROS provider normalization", () => {
  it("normalizes a running workout into an ActivityRecord input", () => {
    const result = normalizeCorosActivity({
      labelId: "run-1",
      sportType: 100,
      startTime: "2026-06-01T10:00:00+08:00",
      endTime: "2026-06-01T10:45:00+08:00",
      distanceKm: 8.2,
      avgHeartRate: 142,
      trainingLoad: 88
    });

    expect(result).toMatchObject({
      source: "coros",
      sourceId: "run-1",
      sportType: "run",
      durationMinutes: 45,
      distanceKm: 8.2,
      averageHeartRateBpm: 142,
      trainingLoad: 88,
      intensity: "moderate"
    });
  });

  it("normalizes sleep and recovery payloads", () => {
    expect(normalizeCorosSleep({
      date: "2026-06-02",
      durationMinutes: 410,
      score: 78
    })).toMatchObject({
      source: "coros",
      durationMinutes: 410,
      qualityScore: 78
    });

    expect(normalizeCorosRecovery({
      date: "2026-06-02",
      recoveryPercent: 42,
      hrvMs: 48,
      restingHeartRateBpm: 56
    })).toMatchObject({
      source: "coros",
      recoveryPercent: 42,
      hrvMs: 48,
      restingHeartRateBpm: 56
    });
  });
});
```

`tests/providers/calendar.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { normalizeFeishuCalendarSnapshot } from "@/src/providers/calendar";

describe("Feishu calendar normalization", () => {
  it("extracts busy and free windows for planning", () => {
    const snapshot = normalizeFeishuCalendarSnapshot({
      rangeStart: "2026-06-01T00:00:00+08:00",
      rangeEnd: "2026-06-07T23:59:59+08:00",
      busy: [
        { start: "2026-06-02T09:00:00+08:00", end: "2026-06-02T10:00:00+08:00", title: "Weekly sync" }
      ],
      free: [
        { start: "2026-06-02T18:30:00+08:00", end: "2026-06-02T19:30:00+08:00" }
      ]
    });

    expect(snapshot.busyWindows).toHaveLength(1);
    expect(snapshot.freeWindows[0]).toMatchObject({
      start: "2026-06-02T18:30:00.000Z",
      end: "2026-06-02T19:30:00.000Z"
    });
  });
});
```

`tests/providers/meal-menu.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getMockMealMenu } from "@/src/providers/meal-menu";

describe("mock meal menu provider", () => {
  it("returns breakfast, lunch, and dinner menu items", () => {
    const menus = getMockMealMenu(new Date("2026-06-02T00:00:00+08:00"));

    expect(menus.map((menu) => menu.meal).sort()).toEqual(["breakfast", "dinner", "lunch"]);
    expect(menus[0].items[0]).toHaveProperty("proteinGrams");
  });
});
```

Run:

```bash
npm test -- tests/providers/coros.test.ts tests/providers/calendar.test.ts tests/providers/meal-menu.test.ts
```

Expected: FAIL because provider modules do not exist.

- [ ] **Step 2: Implement domain models**

`src/domain/models.ts`:

```ts
export type TrainingIntensity = "recovery" | "easy" | "moderate" | "hard";
export type TrainingStatus = "planned" | "completed" | "partial" | "skipped" | "over_completed";
export type GoalType = "long_term" | "primary" | "short_term_event" | "secondary";

export type TimeWindow = {
  start: string;
  end: string;
  title?: string;
};

export type NormalizedActivityRecord = {
  source: "coros";
  sourceId?: string;
  sportType: "run" | "ride" | "strength" | "other";
  startedAt: Date;
  endedAt: Date;
  durationMinutes: number;
  distanceKm?: number;
  averagePaceSecPerKm?: number;
  averageSpeedKph?: number;
  averageHeartRateBpm?: number;
  calories?: number;
  trainingLoad?: number;
  intensity: TrainingIntensity;
  metadata: Record<string, unknown>;
};

export type NormalizedSleepRecord = {
  source: "coros";
  date: Date;
  sleepStart?: Date;
  sleepEnd?: Date;
  durationMinutes: number;
  qualityScore?: number;
  metadata: Record<string, unknown>;
};

export type NormalizedRecoveryRecord = {
  source: "coros";
  date: Date;
  recoveryPercent?: number;
  hrvMs?: number;
  restingHeartRateBpm?: number;
  stressLevel?: number;
  trainingLoadShortTerm?: number;
  trainingLoadLongTerm?: number;
  metadata: Record<string, unknown>;
};

export type NormalizedCalendarSnapshot = {
  source: "feishu";
  rangeStart: Date;
  rangeEnd: Date;
  busyWindows: TimeWindow[];
  freeWindows: TimeWindow[];
  importantEvents: TimeWindow[];
};

export type MealMenuItem = {
  name: string;
  calories: number;
  proteinGrams: number;
  carbohydrateGrams: number;
  fatGrams: number;
  tags: string[];
};

export type MealMenu = {
  source: "mock";
  date: Date;
  meal: "breakfast" | "lunch" | "dinner";
  items: MealMenuItem[];
};
```

`src/domain/validation.ts`:

```ts
import { z } from "zod";

export const bodyProfileSchema = z.object({
  heightCm: z.number().min(80).max(250),
  weightKg: z.number().min(25).max(300),
  bodyFatPercent: z.number().min(2).max(70).optional(),
  birthday: z.string().optional(),
  sex: z.enum(["male", "female", "other"]),
  restingHeartRateBpm: z.number().min(30).max(130).optional(),
  trainingExperience: z.enum(["beginner", "intermediate", "advanced"]),
  injuries: z.array(z.string()),
  dietaryPreferences: z.array(z.string()),
  trainingPreferences: z.array(z.string())
});

export const goalSchema = z.object({
  title: z.string().min(2),
  type: z.enum(["long_term", "primary", "short_term_event", "secondary"]),
  priority: z.number().int().min(1).max(10),
  status: z.enum(["active", "paused", "completed"]).default("active"),
  targetDate: z.string().optional(),
  metrics: z.record(z.unknown()).default({})
});
```

- [ ] **Step 3: Implement providers**

`src/providers/coros.ts`:

```ts
import type { NormalizedActivityRecord, NormalizedRecoveryRecord, NormalizedSleepRecord, TrainingIntensity } from "@/src/domain/models";

type CorosActivityPayload = {
  labelId?: string;
  sportType: number;
  startTime: string;
  endTime: string;
  distanceKm?: number;
  avgHeartRate?: number;
  calories?: number;
  trainingLoad?: number;
};

type CorosSleepPayload = {
  date: string;
  sleepStart?: string;
  sleepEnd?: string;
  durationMinutes: number;
  score?: number;
};

type CorosRecoveryPayload = {
  date: string;
  recoveryPercent?: number;
  hrvMs?: number;
  restingHeartRateBpm?: number;
  stressLevel?: number;
  trainingLoadShortTerm?: number;
  trainingLoadLongTerm?: number;
};

function sportTypeName(sportType: number): NormalizedActivityRecord["sportType"] {
  if ([100, 101, 102, 103].includes(sportType)) return "run";
  if ([200, 201, 202, 203, 204, 205, 299].includes(sportType)) return "ride";
  if (sportType === 402) return "strength";
  return "other";
}

function classifyIntensity(trainingLoad?: number): TrainingIntensity {
  if (trainingLoad === undefined) return "easy";
  if (trainingLoad < 40) return "easy";
  if (trainingLoad < 100) return "moderate";
  return "hard";
}

export function normalizeCorosActivity(payload: CorosActivityPayload): NormalizedActivityRecord {
  const startedAt = new Date(payload.startTime);
  const endedAt = new Date(payload.endTime);
  const durationMinutes = Math.round((endedAt.getTime() - startedAt.getTime()) / 60000);

  return {
    source: "coros",
    sourceId: payload.labelId,
    sportType: sportTypeName(payload.sportType),
    startedAt,
    endedAt,
    durationMinutes,
    distanceKm: payload.distanceKm,
    averageHeartRateBpm: payload.avgHeartRate,
    calories: payload.calories,
    trainingLoad: payload.trainingLoad,
    intensity: classifyIntensity(payload.trainingLoad),
    metadata: payload
  };
}

export function normalizeCorosSleep(payload: CorosSleepPayload): NormalizedSleepRecord {
  return {
    source: "coros",
    date: new Date(`${payload.date}T00:00:00+08:00`),
    sleepStart: payload.sleepStart ? new Date(payload.sleepStart) : undefined,
    sleepEnd: payload.sleepEnd ? new Date(payload.sleepEnd) : undefined,
    durationMinutes: payload.durationMinutes,
    qualityScore: payload.score,
    metadata: payload
  };
}

export function normalizeCorosRecovery(payload: CorosRecoveryPayload): NormalizedRecoveryRecord {
  return {
    source: "coros",
    date: new Date(`${payload.date}T00:00:00+08:00`),
    recoveryPercent: payload.recoveryPercent,
    hrvMs: payload.hrvMs,
    restingHeartRateBpm: payload.restingHeartRateBpm,
    stressLevel: payload.stressLevel,
    trainingLoadShortTerm: payload.trainingLoadShortTerm,
    trainingLoadLongTerm: payload.trainingLoadLongTerm,
    metadata: payload
  };
}
```

`src/providers/calendar.ts`:

```ts
import type { NormalizedCalendarSnapshot, TimeWindow } from "@/src/domain/models";

type FeishuWindow = {
  start: string;
  end: string;
  title?: string;
};

type FeishuCalendarPayload = {
  rangeStart: string;
  rangeEnd: string;
  busy: FeishuWindow[];
  free: FeishuWindow[];
};

function normalizeWindow(window: FeishuWindow): TimeWindow {
  return {
    start: new Date(window.start).toISOString(),
    end: new Date(window.end).toISOString(),
    title: window.title
  };
}

export function normalizeFeishuCalendarSnapshot(payload: FeishuCalendarPayload): NormalizedCalendarSnapshot {
  const busyWindows = payload.busy.map(normalizeWindow);

  return {
    source: "feishu",
    rangeStart: new Date(payload.rangeStart),
    rangeEnd: new Date(payload.rangeEnd),
    busyWindows,
    freeWindows: payload.free.map(normalizeWindow),
    importantEvents: busyWindows.filter((window) => /travel|flight|doctor|race|比赛|出差|体检/.test(window.title ?? ""))
  };
}
```

`src/providers/meal-menu.ts`:

```ts
import type { MealMenu } from "@/src/domain/models";

export function getMockMealMenu(date: Date): MealMenu[] {
  return [
    {
      source: "mock",
      date,
      meal: "breakfast",
      items: [
        { name: "Oatmeal with eggs", calories: 430, proteinGrams: 24, carbohydrateGrams: 52, fatGrams: 12, tags: ["high-protein", "moderate-carb"] },
        { name: "Soy milk and steamed bun", calories: 520, proteinGrams: 18, carbohydrateGrams: 78, fatGrams: 14, tags: ["high-carb"] }
      ]
    },
    {
      source: "mock",
      date,
      meal: "lunch",
      items: [
        { name: "Chicken rice bowl", calories: 680, proteinGrams: 42, carbohydrateGrams: 72, fatGrams: 20, tags: ["high-protein"] },
        { name: "Fried noodles", calories: 830, proteinGrams: 25, carbohydrateGrams: 96, fatGrams: 34, tags: ["fried", "high-carb"] }
      ]
    },
    {
      source: "mock",
      date,
      meal: "dinner",
      items: [
        { name: "Fish, vegetables, and rice", calories: 610, proteinGrams: 40, carbohydrateGrams: 58, fatGrams: 18, tags: ["high-protein", "light"] },
        { name: "Beef noodle soup", calories: 760, proteinGrams: 36, carbohydrateGrams: 88, fatGrams: 24, tags: ["high-carb"] }
      ]
    }
  ];
}
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm test -- tests/providers/coros.test.ts tests/providers/calendar.test.ts tests/providers/meal-menu.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain src/providers tests/providers
git commit -m "feat: add provider normalization"
```

---

### Task 4: Auth And Sessions

**Files:**
- Create: `src/auth/password.ts`
- Create: `src/auth/session.ts`
- Create: `tests/auth/password.test.ts`
- Create: `app/api/auth/login/route.ts`
- Create: `app/api/auth/logout/route.ts`
- Create: `app/(auth)/login/page.tsx`
- Create: `scripts/seed.ts`

- [ ] **Step 1: Write failing password tests**

`tests/auth/password.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/src/auth/password";

describe("password hashing", () => {
  it("verifies a correct password and rejects a wrong password", () => {
    const hash = hashPassword("correct horse battery staple");

    expect(hash).toContain(":");
    expect(verifyPassword("correct horse battery staple", hash)).toBe(true);
    expect(verifyPassword("wrong password", hash)).toBe(false);
  });
});
```

Run:

```bash
npm test -- tests/auth/password.test.ts
```

Expected: FAIL because `src/auth/password.ts` does not exist.

- [ ] **Step 2: Implement password hashing**

`src/auth/password.ts`:

```ts
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;

  const candidate = scryptSync(password, salt, KEY_LENGTH);
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) return false;

  return timingSafeEqual(candidate, expected);
}
```

- [ ] **Step 3: Implement session helpers**

`src/auth/session.ts`:

```ts
import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/src/db/client";

const COOKIE_NAME = "hbm_session";
const SESSION_DAYS = 30;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt
    }
  });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/"
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  cookieStore.delete(COOKIE_NAME);
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true }
  });

  if (!session || session.expiresAt < new Date()) return null;
  return session.user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}
```

- [ ] **Step 4: Implement auth API routes**

`app/api/auth/login/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createSession } from "@/src/auth/session";
import { verifyPassword } from "@/src/auth/password";
import { prisma } from "@/src/db/client";

export async function POST(request: Request) {
  const body = await request.json();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  await createSession(user.id);
  return NextResponse.json({ ok: true });
}
```

`app/api/auth/logout/route.ts`:

```ts
import { NextResponse } from "next/server";
import { destroySession } from "@/src/auth/session";

export async function POST() {
  await destroySession();
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: Implement login page**

`app/(auth)/login/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { LogIn } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("demo@example.com");
  const [password, setPassword] = useState("healthy-body-demo");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    if (!response.ok) {
      setError("Invalid email or password");
      return;
    }
    window.location.href = "/plan";
  }

  return (
    <main className="page">
      <form className="surface" onSubmit={submit} style={{ maxWidth: 420, margin: "80px auto", padding: 24 }}>
        <h1>Healthy Body Manager</h1>
        <label>
          Email
          <input value={email} onChange={(event) => setEmail(event.target.value)} style={{ width: "100%", marginTop: 8, marginBottom: 16 }} />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} style={{ width: "100%", marginTop: 8, marginBottom: 16 }} />
        </label>
        {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
        <button type="submit">
          <LogIn size={16} /> Sign in
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 6: Create seed script**

`scripts/seed.ts`:

```ts
import { prisma } from "@/src/db/client";
import { hashPassword } from "@/src/auth/password";

async function main() {
  const passwordHash = hashPassword("healthy-body-demo");
  await prisma.user.upsert({
    where: { email: "demo@example.com" },
    update: {},
    create: {
      email: "demo@example.com",
      passwordHash,
      timezone: "Asia/Shanghai"
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
```

- [ ] **Step 7: Run tests and seed**

Run:

```bash
npm test -- tests/auth/password.test.ts
npm run seed
```

Expected:

- Password test passes.
- `demo@example.com` exists in the local database.

- [ ] **Step 8: Commit**

```bash
git add src/auth tests/auth app/api/auth app/'(auth)'/login/page.tsx scripts/seed.ts
git commit -m "feat: add email password auth"
```

---

### Task 5: Profile And Goal Services

**Files:**
- Create: `src/services/profileService.ts`
- Create: `src/services/goalService.ts`
- Create: `tests/services/profileService.test.ts`
- Create: `tests/services/goalService.test.ts`
- Create: `app/api/profile/route.ts`
- Create: `app/api/goals/route.ts`

- [ ] **Step 1: Write failing service tests**

`tests/services/profileService.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseBodyProfileInput } from "@/src/services/profileService";

describe("profile service validation", () => {
  it("accepts a complete profile input", () => {
    const profile = parseBodyProfileInput({
      heightCm: 178,
      weightKg: 72,
      sex: "male",
      trainingExperience: "intermediate",
      injuries: ["left knee sensitivity"],
      dietaryPreferences: ["high protein"],
      trainingPreferences: ["morning runs"]
    });

    expect(profile.heightCm).toBe(178);
    expect(profile.injuries).toEqual(["left knee sensitivity"]);
  });
});
```

`tests/services/goalService.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { sortGoalsByPriority } from "@/src/services/goalService";

describe("goal service", () => {
  it("sorts primary and event goals by priority", () => {
    const goals = sortGoalsByPriority([
      { title: "Sleep better", type: "long_term", priority: 3 },
      { title: "Marathon", type: "short_term_event", priority: 9 },
      { title: "Fat loss", type: "primary", priority: 8 }
    ]);

    expect(goals.map((goal) => goal.title)).toEqual(["Marathon", "Fat loss", "Sleep better"]);
  });
});
```

Run:

```bash
npm test -- tests/services/profileService.test.ts tests/services/goalService.test.ts
```

Expected: FAIL because service modules do not exist.

- [ ] **Step 2: Implement profile service**

`src/services/profileService.ts`:

```ts
import { prisma } from "@/src/db/client";
import { bodyProfileSchema } from "@/src/domain/validation";

export function parseBodyProfileInput(input: unknown) {
  return bodyProfileSchema.parse(input);
}

export async function upsertBodyProfile(userId: string, input: unknown) {
  const profile = parseBodyProfileInput(input);
  const data = {
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
    bodyFatPercent: profile.bodyFatPercent,
    birthday: profile.birthday ? new Date(profile.birthday) : undefined,
    sex: profile.sex,
    restingHeartRateBpm: profile.restingHeartRateBpm,
    trainingExperience: profile.trainingExperience,
    injuriesJson: JSON.stringify(profile.injuries),
    dietaryPreferencesJson: JSON.stringify(profile.dietaryPreferences),
    trainingPreferencesJson: JSON.stringify(profile.trainingPreferences)
  };

  return prisma.bodyProfile.upsert({
    where: { userId },
    update: data,
    create: {
      userId,
      ...data
    }
  });
}

export async function getBodyProfile(userId: string) {
  return prisma.bodyProfile.findUnique({ where: { userId } });
}
```

- [ ] **Step 3: Implement goal service**

`src/services/goalService.ts`:

```ts
import { prisma } from "@/src/db/client";
import { goalSchema } from "@/src/domain/validation";

type SortableGoal = {
  title: string;
  type: string;
  priority: number;
};

export function sortGoalsByPriority<T extends SortableGoal>(goals: T[]): T[] {
  return [...goals].sort((left, right) => right.priority - left.priority);
}

export function parseGoalInput(input: unknown) {
  return goalSchema.parse(input);
}

export async function createGoal(userId: string, input: unknown) {
  const goal = parseGoalInput(input);
  return prisma.goal.create({
    data: {
      userId,
      title: goal.title,
      type: goal.type,
      priority: goal.priority,
      status: goal.status,
      targetDate: goal.targetDate ? new Date(goal.targetDate) : undefined,
      metricsJson: JSON.stringify(goal.metrics)
    }
  });
}

export async function listGoals(userId: string) {
  const goals = await prisma.goal.findMany({
    where: { userId, status: "active" }
  });
  return sortGoalsByPriority(goals);
}
```

- [ ] **Step 4: Implement API routes**

`app/api/profile/route.ts`:

```ts
import { NextResponse } from "next/server";
import { requireUser } from "@/src/auth/session";
import { getBodyProfile, upsertBodyProfile } from "@/src/services/profileService";

export async function GET() {
  const user = await requireUser();
  return NextResponse.json(await getBodyProfile(user.id));
}

export async function POST(request: Request) {
  const user = await requireUser();
  const profile = await upsertBodyProfile(user.id, await request.json());
  return NextResponse.json(profile);
}
```

`app/api/goals/route.ts`:

```ts
import { NextResponse } from "next/server";
import { requireUser } from "@/src/auth/session";
import { createGoal, listGoals } from "@/src/services/goalService";

export async function GET() {
  const user = await requireUser();
  return NextResponse.json(await listGoals(user.id));
}

export async function POST(request: Request) {
  const user = await requireUser();
  const goal = await createGoal(user.id, await request.json());
  return NextResponse.json(goal, { status: 201 });
}
```

- [ ] **Step 5: Run tests**

Run:

```bash
npm test -- tests/services/profileService.test.ts tests/services/goalService.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/services/profileService.ts src/services/goalService.ts tests/services app/api/profile app/api/goals
git commit -m "feat: add profile and goal services"
```

---

### Task 6: Planning Engine And Nutrition Rules

**Files:**
- Create: `src/planning/engine.ts`
- Create: `src/planning/nutrition.ts`
- Create: `src/test/factories.ts`
- Create: `tests/planning/engine.test.ts`
- Create: `tests/planning/nutrition.test.ts`

- [ ] **Step 1: Write failing planning tests**

`src/test/factories.ts`:

```ts
import type { MealMenu, NormalizedCalendarSnapshot, NormalizedRecoveryRecord, NormalizedSleepRecord } from "@/src/domain/models";

export function recovery(overrides: Partial<NormalizedRecoveryRecord> = {}): NormalizedRecoveryRecord {
  return {
    source: "coros",
    date: new Date("2026-06-02T00:00:00+08:00"),
    recoveryPercent: 80,
    hrvMs: 55,
    restingHeartRateBpm: 52,
    metadata: {},
    ...overrides
  };
}

export function sleep(overrides: Partial<NormalizedSleepRecord> = {}): NormalizedSleepRecord {
  return {
    source: "coros",
    date: new Date("2026-06-02T00:00:00+08:00"),
    durationMinutes: 450,
    qualityScore: 82,
    metadata: {},
    ...overrides
  };
}

export function calendarSnapshot(overrides: Partial<NormalizedCalendarSnapshot> = {}): NormalizedCalendarSnapshot {
  return {
    source: "feishu",
    rangeStart: new Date("2026-06-01T00:00:00+08:00"),
    rangeEnd: new Date("2026-06-07T23:59:59+08:00"),
    busyWindows: [],
    freeWindows: [
      { start: "2026-06-02T10:00:00.000Z", end: "2026-06-02T11:00:00.000Z" }
    ],
    importantEvents: [],
    ...overrides
  };
}

export function mealMenus(): MealMenu[] {
  return [
    {
      source: "mock",
      date: new Date("2026-06-02T00:00:00+08:00"),
      meal: "lunch",
      items: [
        { name: "Chicken rice bowl", calories: 680, proteinGrams: 42, carbohydrateGrams: 72, fatGrams: 20, tags: ["high-protein"] },
        { name: "Fried noodles", calories: 830, proteinGrams: 25, carbohydrateGrams: 96, fatGrams: 34, tags: ["fried"] }
      ]
    }
  ];
}
```

`tests/planning/engine.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { generateWeeklyPlan } from "@/src/planning/engine";
import { calendarSnapshot, recovery, sleep } from "@/src/test/factories";

describe("planning engine", () => {
  it("blocks hard training when sleep is poor", () => {
    const plan = generateWeeklyPlan({
      weekStart: new Date("2026-06-01T00:00:00+08:00"),
      profile: { trainingExperience: "intermediate", injuries: [] },
      goals: [{ title: "Marathon", type: "short_term_event", priority: 9 }],
      activities: [],
      sleepRecords: [sleep({ durationMinutes: 280, qualityScore: 45 })],
      recoveryRecords: [recovery({ recoveryPercent: 38 })],
      calendar: calendarSnapshot(),
      mealMenus: []
    });

    expect(plan.tasks[0].intensity).toBe("recovery");
    expect(plan.explanation).toContain("sleep");
  });

  it("uses available calendar windows for scheduled training", () => {
    const plan = generateWeeklyPlan({
      weekStart: new Date("2026-06-01T00:00:00+08:00"),
      profile: { trainingExperience: "intermediate", injuries: [] },
      goals: [{ title: "Fat loss", type: "primary", priority: 8 }],
      activities: [],
      sleepRecords: [sleep()],
      recoveryRecords: [recovery()],
      calendar: calendarSnapshot(),
      mealMenus: []
    });

    expect(plan.tasks[0].scheduledStart).toBe("2026-06-02T10:00:00.000Z");
  });
});
```

`tests/planning/nutrition.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { recommendMenuChoices } from "@/src/planning/nutrition";
import { mealMenus } from "@/src/test/factories";

describe("nutrition planning", () => {
  it("prefers high-protein menu items and cautions fried items", () => {
    const result = recommendMenuChoices({
      menus: mealMenus(),
      trainingIntensity: "moderate",
      primaryGoal: "Fat loss"
    });

    expect(result.recommended[0].name).toBe("Chicken rice bowl");
    expect(result.caution[0].name).toBe("Fried noodles");
  });
});
```

Run:

```bash
npm test -- tests/planning/engine.test.ts tests/planning/nutrition.test.ts
```

Expected: FAIL because planning modules do not exist.

- [ ] **Step 2: Implement nutrition rules**

`src/planning/nutrition.ts`:

```ts
import type { MealMenu, MealMenuItem, TrainingIntensity } from "@/src/domain/models";

export type NutritionRecommendation = {
  calorieTarget: string;
  proteinTargetGrams: number;
  carbohydrateGuidance: string;
  recommended: MealMenuItem[];
  caution: MealMenuItem[];
};

export function recommendMenuChoices(input: {
  menus: MealMenu[];
  trainingIntensity: TrainingIntensity;
  primaryGoal: string;
}): NutritionRecommendation {
  const items = input.menus.flatMap((menu) => menu.items);
  const recommended = items
    .filter((item) => item.proteinGrams >= 35 || item.tags.includes("light"))
    .sort((left, right) => right.proteinGrams - left.proteinGrams);
  const caution = items.filter((item) => item.tags.includes("fried") || item.fatGrams >= 30);

  return {
    calorieTarget: input.primaryGoal.toLowerCase().includes("loss") ? "moderate deficit" : "maintenance",
    proteinTargetGrams: 120,
    carbohydrateGuidance: input.trainingIntensity === "hard" ? "prioritize carbohydrates before and after training" : "keep carbohydrates moderate and pair them with protein",
    recommended,
    caution
  };
}
```

- [ ] **Step 3: Implement planning engine**

`src/planning/engine.ts`:

```ts
import type {
  MealMenu,
  NormalizedActivityRecord,
  NormalizedCalendarSnapshot,
  NormalizedRecoveryRecord,
  NormalizedSleepRecord,
  TrainingIntensity
} from "@/src/domain/models";
import { recommendMenuChoices } from "@/src/planning/nutrition";

type PlanningGoal = {
  title: string;
  type: string;
  priority: number;
};

type PlanningProfile = {
  trainingExperience: string;
  injuries: string[];
};

export type GeneratedTrainingTask = {
  date: string;
  title: string;
  trainingType: string;
  durationMinutes: number;
  intensity: TrainingIntensity;
  target: Record<string, unknown>;
  scheduledStart?: string;
  scheduledEnd?: string;
  checklist: string[];
};

export type GeneratedWeeklyPlan = {
  weekStart: string;
  weekEnd: string;
  summary: string;
  tasks: GeneratedTrainingTask[];
  nutritionTargets: ReturnType<typeof recommendMenuChoices>;
  explanation: string;
};

export function generateWeeklyPlan(input: {
  weekStart: Date;
  profile: PlanningProfile;
  goals: PlanningGoal[];
  activities: NormalizedActivityRecord[];
  sleepRecords: NormalizedSleepRecord[];
  recoveryRecords: NormalizedRecoveryRecord[];
  calendar: NormalizedCalendarSnapshot;
  mealMenus: MealMenu[];
}): GeneratedWeeklyPlan {
  const latestSleep = input.sleepRecords.at(-1);
  const latestRecovery = input.recoveryRecords.at(-1);
  const poorSleep = (latestSleep?.durationMinutes ?? 999) < 360 || (latestSleep?.qualityScore ?? 100) < 55;
  const poorRecovery = (latestRecovery?.recoveryPercent ?? 100) < 50;
  const hasInjury = input.profile.injuries.length > 0;
  const primaryGoal = [...input.goals].sort((left, right) => right.priority - left.priority)[0]?.title ?? "General fitness";
  const firstWindow = input.calendar.freeWindows[0];

  const intensity: TrainingIntensity = poorSleep || poorRecovery || hasInjury ? "recovery" : "moderate";
  const durationMinutes = intensity === "recovery" ? 30 : 50;
  const title = intensity === "recovery" ? "Recovery mobility and easy walk" : "Aerobic base session";

  const task: GeneratedTrainingTask = {
    date: new Date(input.weekStart.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    title,
    trainingType: intensity === "recovery" ? "recovery" : "run",
    durationMinutes,
    intensity,
    target: intensity === "recovery" ? { effort: "easy", heartRateZone: "Z1" } : { effort: "steady", heartRateZone: "Z2" },
    scheduledStart: firstWindow?.start,
    scheduledEnd: firstWindow?.end,
    checklist: intensity === "recovery"
      ? ["Easy warmup", "Mobility flow", "Walk or spin easy", "Stretch"]
      : ["Warmup 10 minutes", "Main aerobic work", "Cooldown 5 minutes", "Stretch", "Record perceived effort"]
  };

  const followUpTasks: GeneratedTrainingTask[] = [
    {
      date: new Date(input.weekStart.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      title: "Strength maintenance",
      trainingType: "strength",
      durationMinutes: 35,
      intensity: poorSleep || poorRecovery ? "easy" : "moderate",
      target: { focus: "full-body strength", effort: "controlled" },
      checklist: ["Warmup joints", "Main strength circuit", "Core work", "Stretch"]
    },
    {
      date: new Date(input.weekStart.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      title: primaryGoal.toLowerCase().includes("marathon") ? "Long easy run" : "Long aerobic session",
      trainingType: primaryGoal.toLowerCase().includes("cycling") ? "ride" : "run",
      durationMinutes: primaryGoal.toLowerCase().includes("marathon") ? 75 : 60,
      intensity: "easy",
      target: { effort: "easy", heartRateZone: "Z2" },
      checklist: ["Warmup 10 minutes", "Main endurance work", "Cooldown", "Record perceived effort"]
    }
  ];

  const tasks = [task, ...followUpTasks];

  const nutritionTargets = recommendMenuChoices({
    menus: input.mealMenus,
    trainingIntensity: intensity,
    primaryGoal
  });

  const reasons = [
    poorSleep ? "sleep was below the safe threshold" : "",
    poorRecovery ? "recovery was low" : "",
    hasInjury ? "injury restrictions were present" : ""
  ].filter(Boolean);

  return {
    weekStart: input.weekStart.toISOString(),
    weekEnd: new Date(input.weekStart.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString(),
    summary: `${primaryGoal} week with ${task.title.toLowerCase()}`,
    tasks,
    nutritionTargets,
    explanation: reasons.length > 0 ? `Plan reduced intensity because ${reasons.join(", ")}.` : "Plan uses the best available calendar window and current goal priority."
  };
}
```

- [ ] **Step 4: Run planning tests**

Run:

```bash
npm test -- tests/planning/engine.test.ts tests/planning/nutrition.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/planning src/test/factories.ts tests/planning
git commit -m "feat: add planning engine"
```

---

### Task 7: Daily Checklist And Dynamic Adjustment

**Files:**
- Create: `src/planning/checklist.ts`
- Create: `tests/planning/checklist.test.ts`

- [ ] **Step 1: Write failing checklist tests**

`tests/planning/checklist.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { reconcileChecklistCompletion } from "@/src/planning/checklist";

describe("training checklist reconciliation", () => {
  it("marks all items completed as a completed training task", () => {
    const result = reconcileChecklistCompletion({
      plannedLoad: 80,
      items: [
        { label: "Warmup", status: "completed" },
        { label: "Main set", status: "completed" },
        { label: "Cooldown", status: "completed" }
      ]
    });

    expect(result.status).toBe("completed");
    expect(result.remainingLoadAdjustment).toBe(0);
  });

  it("reduces remaining weekly load after over-completion", () => {
    const result = reconcileChecklistCompletion({
      plannedLoad: 80,
      actualLoad: 130,
      items: [
        { label: "Workout", status: "completed" }
      ]
    });

    expect(result.status).toBe("over_completed");
    expect(result.remainingLoadAdjustment).toBe(-50);
  });

  it("returns a reschedule recommendation when skipped", () => {
    const result = reconcileChecklistCompletion({
      plannedLoad: 80,
      items: [
        { label: "Workout", status: "skipped" }
      ]
    });

    expect(result.status).toBe("skipped");
    expect(result.adjustmentReason).toContain("reschedule");
  });
});
```

Run:

```bash
npm test -- tests/planning/checklist.test.ts
```

Expected: FAIL because checklist module does not exist.

- [ ] **Step 2: Implement checklist reconciliation**

`src/planning/checklist.ts`:

```ts
import type { TrainingStatus } from "@/src/domain/models";

type ChecklistInput = {
  plannedLoad: number;
  actualLoad?: number;
  items: Array<{
    label: string;
    status: "pending" | "completed" | "skipped";
  }>;
};

type ChecklistResult = {
  status: TrainingStatus;
  remainingLoadAdjustment: number;
  adjustmentReason: string;
};

export function reconcileChecklistCompletion(input: ChecklistInput): ChecklistResult {
  const completed = input.items.filter((item) => item.status === "completed").length;
  const skipped = input.items.filter((item) => item.status === "skipped").length;
  const actualLoad = input.actualLoad ?? Math.round(input.plannedLoad * (completed / input.items.length));

  if (skipped === input.items.length) {
    return {
      status: "skipped",
      remainingLoadAdjustment: input.plannedLoad,
      adjustmentReason: "Training was skipped; attempt to reschedule or downgrade later sessions based on recovery and calendar windows."
    };
  }

  if (actualLoad > input.plannedLoad * 1.25) {
    return {
      status: "over_completed",
      remainingLoadAdjustment: input.plannedLoad - actualLoad,
      adjustmentReason: "Actual load exceeded planned load; reduce remaining weekly intensity."
    };
  }

  if (completed === input.items.length) {
    return {
      status: "completed",
      remainingLoadAdjustment: 0,
      adjustmentReason: "Training completed as planned."
    };
  }

  return {
    status: "partial",
    remainingLoadAdjustment: input.plannedLoad - actualLoad,
    adjustmentReason: "Training was partially completed; adjust remaining weekly work conservatively."
  };
}
```

- [ ] **Step 3: Run checklist tests**

Run:

```bash
npm test -- tests/planning/checklist.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/planning/checklist.ts tests/planning/checklist.test.ts
git commit -m "feat: add training checklist reconciliation"
```

---

### Task 8: Checklist Completion Service And API

**Files:**
- Create: `src/services/checklistService.ts`
- Create: `tests/services/checklistService.test.ts`
- Create: `app/api/training/tasks/[id]/completion/route.ts`

- [ ] **Step 1: Write failing checklist service test**

`tests/services/checklistService.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildChecklistCompletion } from "@/src/services/checklistService";

describe("checklist completion service helpers", () => {
  it("builds a completion payload and adjustment from checklist state", () => {
    const result = buildChecklistCompletion({
      plannedLoad: 70,
      items: [
        { label: "Warmup", status: "completed" },
        { label: "Main run", status: "skipped" },
        { label: "Cooldown", status: "completed" }
      ]
    });

    expect(result.completion.status).toBe("partial");
    expect(result.adjustment.reason).toContain("partially completed");
    expect(result.remainingLoadAdjustment).toBeGreaterThan(0);
  });
});
```

Run:

```bash
npm test -- tests/services/checklistService.test.ts
```

Expected: FAIL because checklist service does not exist.

- [ ] **Step 2: Implement checklist service**

`src/services/checklistService.ts`:

```ts
import { prisma } from "@/src/db/client";
import { reconcileChecklistCompletion } from "@/src/planning/checklist";

type CompletionItemInput = {
  id?: string;
  label: string;
  status: "pending" | "completed" | "skipped";
};

export function buildChecklistCompletion(input: {
  plannedLoad: number;
  actualLoad?: number;
  items: CompletionItemInput[];
}) {
  const reconciliation = reconcileChecklistCompletion({
    plannedLoad: input.plannedLoad,
    actualLoad: input.actualLoad,
    items: input.items
  });

  return {
    completion: {
      status: reconciliation.status,
      plannedVsActualJson: JSON.stringify({
        plannedLoad: input.plannedLoad,
        actualLoad: input.actualLoad,
        remainingLoadAdjustment: reconciliation.remainingLoadAdjustment
      })
    },
    remainingLoadAdjustment: reconciliation.remainingLoadAdjustment,
    adjustment: {
      trigger: "checklist_completion",
      reason: reconciliation.adjustmentReason,
      explanation: reconciliation.adjustmentReason,
      previousStateJson: JSON.stringify({ plannedLoad: input.plannedLoad }),
      newStateJson: JSON.stringify({
        status: reconciliation.status,
        remainingLoadAdjustment: reconciliation.remainingLoadAdjustment
      })
    }
  };
}

export async function completeTrainingTask(userId: string, taskId: string, input: {
  actualLoad?: number;
  perceivedEffort?: string;
  notes?: string;
  items: CompletionItemInput[];
}) {
  const task = await prisma.trainingTask.findFirst({
    where: { id: taskId, userId },
    include: { checklistItems: true, plan: true }
  });

  if (!task) throw new Error("Training task not found");

  for (const item of input.items) {
    if (item.id) {
      await prisma.trainingChecklistItem.updateMany({
        where: { id: item.id, taskId },
        data: { status: item.status }
      });
    }
  }

  const built = buildChecklistCompletion({
    plannedLoad: task.durationMinutes,
    actualLoad: input.actualLoad,
    items: input.items
  });

  await prisma.trainingTask.update({
    where: { id: task.id },
    data: { status: built.completion.status }
  });

  await prisma.trainingCompletion.upsert({
    where: { taskId: task.id },
    update: {
      status: built.completion.status,
      perceivedEffort: input.perceivedEffort,
      notes: input.notes,
      plannedVsActualJson: built.completion.plannedVsActualJson
    },
    create: {
      taskId: task.id,
      userId,
      status: built.completion.status,
      perceivedEffort: input.perceivedEffort,
      notes: input.notes,
      plannedVsActualJson: built.completion.plannedVsActualJson
    }
  });

  const futureTask = await prisma.trainingTask.findFirst({
    where: {
      planId: task.planId,
      userId,
      date: { gt: task.date },
      status: "planned"
    },
    orderBy: { date: "asc" }
  });

  if (futureTask && built.completion.status === "over_completed") {
    await prisma.trainingTask.update({
      where: { id: futureTask.id },
      data: {
        intensity: "easy",
        durationMinutes: Math.max(20, futureTask.durationMinutes - 15),
        title: `Reduced load: ${futureTask.title}`
      }
    });
  }

  if (futureTask && built.completion.status === "skipped") {
    await prisma.trainingTask.update({
      where: { id: futureTask.id },
      data: {
        durationMinutes: futureTask.durationMinutes + Math.min(20, Math.round(task.durationMinutes / 2)),
        title: `Rescheduled focus: ${futureTask.title}`
      }
    });
  }

  if (futureTask && built.completion.status === "partial") {
    await prisma.trainingTask.update({
      where: { id: futureTask.id },
      data: {
        intensity: futureTask.intensity === "hard" ? "moderate" : futureTask.intensity,
        title: `Adjusted after partial completion: ${futureTask.title}`
      }
    });
  }

  await prisma.planAdjustment.create({
    data: {
      planId: task.planId,
      userId,
      ...built.adjustment
    }
  });

  return prisma.trainingTask.findUnique({
    where: { id: task.id },
    include: {
      checklistItems: true,
      completion: true,
      plan: { include: { adjustments: true } }
    }
  });
}
```

- [ ] **Step 3: Implement completion API route**

`app/api/training/tasks/[id]/completion/route.ts`:

```ts
import { NextResponse } from "next/server";
import { requireUser } from "@/src/auth/session";
import { completeTrainingTask } from "@/src/services/checklistService";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await context.params;
  const body = await request.json();
  const task = await completeTrainingTask(user.id, id, {
    actualLoad: body.actualLoad,
    perceivedEffort: body.perceivedEffort,
    notes: body.notes,
    items: body.items
  });
  return NextResponse.json(task);
}
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm test -- tests/services/checklistService.test.ts tests/planning/checklist.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/checklistService.ts tests/services/checklistService.test.ts app/api/training
git commit -m "feat: add checklist completion service"
```

---

### Task 9: Plan Service, Sync Service, And Calendar Draft Rules

**Files:**
- Create: `src/planning/calendarDrafts.ts`
- Create: `src/services/syncService.ts`
- Create: `src/services/planService.ts`
- Create: `src/services/calendarDraftService.ts`
- Create: `tests/planning/calendarDrafts.test.ts`
- Create: `app/api/sync/coros/route.ts`
- Create: `app/api/sync/calendar/route.ts`
- Create: `app/api/plan/generate/route.ts`
- Create: `app/api/calendar/drafts/route.ts`
- Create: `app/api/calendar/drafts/[id]/confirm/route.ts`

- [ ] **Step 1: Write failing calendar draft tests**

`tests/planning/calendarDrafts.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createCalendarDraftsFromTasks } from "@/src/planning/calendarDrafts";

describe("calendar draft generation", () => {
  it("creates draft events from scheduled training tasks", () => {
    const drafts = createCalendarDraftsFromTasks([
      {
        id: "task-1",
        title: "Aerobic base session",
        scheduledStart: "2026-06-02T10:00:00.000Z",
        scheduledEnd: "2026-06-02T11:00:00.000Z",
        trainingType: "run",
        intensity: "moderate"
      }
    ]);

    expect(drafts[0]).toMatchObject({
      title: "Training: Aerobic base session",
      notes: "Type: run. Intensity: moderate.",
      trainingTaskId: "task-1"
    });
  });
});
```

Run:

```bash
npm test -- tests/planning/calendarDrafts.test.ts
```

Expected: FAIL because calendar draft module does not exist.

- [ ] **Step 2: Implement calendar draft rules**

`src/planning/calendarDrafts.ts`:

```ts
type ScheduledTask = {
  id: string;
  title: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  trainingType: string;
  intensity: string;
};

export function createCalendarDraftsFromTasks(tasks: ScheduledTask[]) {
  return tasks
    .filter((task) => task.scheduledStart && task.scheduledEnd)
    .map((task) => ({
      trainingTaskId: task.id,
      title: `Training: ${task.title}`,
      startsAt: new Date(task.scheduledStart as string),
      endsAt: new Date(task.scheduledEnd as string),
      notes: `Type: ${task.trainingType}. Intensity: ${task.intensity}.`
    }));
}
```

- [ ] **Step 3: Implement sync service**

`src/services/syncService.ts`:

```ts
import { prisma } from "@/src/db/client";
import { normalizeFeishuCalendarSnapshot } from "@/src/providers/calendar";
import { normalizeCorosActivity, normalizeCorosRecovery, normalizeCorosSleep } from "@/src/providers/coros";

export async function importCorosPayload(userId: string, payload: { activities?: unknown[]; sleep?: unknown[]; recovery?: unknown[] }) {
  const activities = (payload.activities ?? []).map((item) => normalizeCorosActivity(item as never));
  const sleepRecords = (payload.sleep ?? []).map((item) => normalizeCorosSleep(item as never));
  const recoveryRecords = (payload.recovery ?? []).map((item) => normalizeCorosRecovery(item as never));

  await prisma.activityRecord.createMany({
    data: activities.map((activity) => ({
      userId,
      source: activity.source,
      sourceId: activity.sourceId,
      sportType: activity.sportType,
      startedAt: activity.startedAt,
      endedAt: activity.endedAt,
      durationMinutes: activity.durationMinutes,
      distanceKm: activity.distanceKm,
      averagePaceSecPerKm: activity.averagePaceSecPerKm,
      averageSpeedKph: activity.averageSpeedKph,
      averageHeartRateBpm: activity.averageHeartRateBpm,
      calories: activity.calories,
      trainingLoad: activity.trainingLoad,
      intensity: activity.intensity,
      metadataJson: JSON.stringify(activity.metadata)
    }))
  });
  await prisma.sleepRecord.createMany({
    data: sleepRecords.map((sleep) => ({
      userId,
      source: sleep.source,
      date: sleep.date,
      sleepStart: sleep.sleepStart,
      sleepEnd: sleep.sleepEnd,
      durationMinutes: sleep.durationMinutes,
      qualityScore: sleep.qualityScore,
      metadataJson: JSON.stringify(sleep.metadata)
    }))
  });
  await prisma.recoveryRecord.createMany({
    data: recoveryRecords.map((recovery) => ({
      userId,
      source: recovery.source,
      date: recovery.date,
      recoveryPercent: recovery.recoveryPercent,
      hrvMs: recovery.hrvMs,
      restingHeartRateBpm: recovery.restingHeartRateBpm,
      stressLevel: recovery.stressLevel,
      trainingLoadShortTerm: recovery.trainingLoadShortTerm,
      trainingLoadLongTerm: recovery.trainingLoadLongTerm,
      metadataJson: JSON.stringify(recovery.metadata)
    }))
  });

  return { activities: activities.length, sleep: sleepRecords.length, recovery: recoveryRecords.length };
}

export async function importCalendarPayload(userId: string, payload: unknown) {
  const snapshot = normalizeFeishuCalendarSnapshot(payload as never);
  return prisma.calendarSnapshot.create({
    data: {
      userId,
      source: snapshot.source,
      rangeStart: snapshot.rangeStart,
      rangeEnd: snapshot.rangeEnd,
      busyWindowsJson: JSON.stringify(snapshot.busyWindows),
      freeWindowsJson: JSON.stringify(snapshot.freeWindows),
      importantEventsJson: JSON.stringify(snapshot.importantEvents)
    }
  });
}
```

- [ ] **Step 4: Implement plan and calendar draft services**

`src/services/planService.ts`:

```ts
import { prisma } from "@/src/db/client";
import { getMockMealMenu } from "@/src/providers/meal-menu";
import { generateWeeklyPlan } from "@/src/planning/engine";
import { createCalendarDraftsFromTasks } from "@/src/planning/calendarDrafts";

function parseJson<T>(value: string): T {
  return JSON.parse(value) as T;
}

export async function generatePlanForUser(userId: string, weekStart: Date) {
  const [profile, goals, activities, sleepRecords, recoveryRecords, calendar] = await Promise.all([
    prisma.bodyProfile.findUnique({ where: { userId } }),
    prisma.goal.findMany({ where: { userId, status: "active" } }),
    prisma.activityRecord.findMany({ where: { userId }, orderBy: { startedAt: "asc" }, take: 30 }),
    prisma.sleepRecord.findMany({ where: { userId }, orderBy: { date: "asc" }, take: 14 }),
    prisma.recoveryRecord.findMany({ where: { userId }, orderBy: { date: "asc" }, take: 14 }),
    prisma.calendarSnapshot.findFirst({ where: { userId }, orderBy: { capturedAt: "desc" } })
  ]);

  if (!profile) throw new Error("Body profile is required before generating a plan.");
  if (!calendar) throw new Error("Calendar snapshot is required before generating a plan.");

  const generated = generateWeeklyPlan({
    weekStart,
    profile: { trainingExperience: profile.trainingExperience, injuries: parseJson<string[]>(profile.injuriesJson) },
    goals: goals.map((goal) => ({ title: goal.title, type: goal.type, priority: goal.priority })),
    activities: activities.map((activity) => ({
      source: "coros",
      sourceId: activity.sourceId ?? undefined,
      sportType: activity.sportType as never,
      startedAt: activity.startedAt,
      endedAt: activity.endedAt,
      durationMinutes: activity.durationMinutes,
      distanceKm: activity.distanceKm ?? undefined,
      averagePaceSecPerKm: activity.averagePaceSecPerKm ?? undefined,
      averageSpeedKph: activity.averageSpeedKph ?? undefined,
      averageHeartRateBpm: activity.averageHeartRateBpm ?? undefined,
      calories: activity.calories ?? undefined,
      trainingLoad: activity.trainingLoad ?? undefined,
      intensity: activity.intensity as never,
      metadata: parseJson<Record<string, unknown>>(activity.metadataJson)
    })),
    sleepRecords: sleepRecords.map((sleep) => ({
      source: "coros",
      date: sleep.date,
      sleepStart: sleep.sleepStart ?? undefined,
      sleepEnd: sleep.sleepEnd ?? undefined,
      durationMinutes: sleep.durationMinutes,
      qualityScore: sleep.qualityScore ?? undefined,
      metadata: parseJson<Record<string, unknown>>(sleep.metadataJson)
    })),
    recoveryRecords: recoveryRecords.map((recovery) => ({
      source: "coros",
      date: recovery.date,
      recoveryPercent: recovery.recoveryPercent ?? undefined,
      hrvMs: recovery.hrvMs ?? undefined,
      restingHeartRateBpm: recovery.restingHeartRateBpm ?? undefined,
      stressLevel: recovery.stressLevel ?? undefined,
      trainingLoadShortTerm: recovery.trainingLoadShortTerm ?? undefined,
      trainingLoadLongTerm: recovery.trainingLoadLongTerm ?? undefined,
      metadata: parseJson<Record<string, unknown>>(recovery.metadataJson)
    })),
    calendar: {
      source: "feishu",
      rangeStart: calendar.rangeStart,
      rangeEnd: calendar.rangeEnd,
      busyWindows: parseJson(calendar.busyWindowsJson),
      freeWindows: parseJson(calendar.freeWindowsJson),
      importantEvents: parseJson(calendar.importantEventsJson)
    },
    mealMenus: getMockMealMenu(weekStart)
  });

  const plan = await prisma.plan.create({
    data: {
      userId,
      weekStart,
      weekEnd: new Date(generated.weekEnd),
      summary: generated.summary,
      nutritionTargetsJson: JSON.stringify(generated.nutritionTargets),
      menuRecommendationsJson: JSON.stringify(generated.nutritionTargets),
      explanation: generated.explanation,
      trainingTasks: {
        create: generated.tasks.map((task) => ({
          userId,
          date: new Date(task.date),
          title: task.title,
          trainingType: task.trainingType,
          durationMinutes: task.durationMinutes,
          intensity: task.intensity,
          targetJson: JSON.stringify(task.target),
          scheduledStart: task.scheduledStart ? new Date(task.scheduledStart) : undefined,
          scheduledEnd: task.scheduledEnd ? new Date(task.scheduledEnd) : undefined,
          checklistItems: {
            create: task.checklist.map((label, index) => ({ label, order: index + 1 }))
          }
        }))
      }
    },
    include: { trainingTasks: true }
  });

  const drafts = createCalendarDraftsFromTasks(plan.trainingTasks.map((task) => ({
    id: task.id,
    title: task.title,
    scheduledStart: task.scheduledStart?.toISOString(),
    scheduledEnd: task.scheduledEnd?.toISOString(),
    trainingType: task.trainingType,
    intensity: task.intensity
  })));

  await prisma.calendarEventDraft.createMany({
    data: drafts.map((draft) => ({ userId, planId: plan.id, ...draft }))
  });

  return prisma.plan.findUnique({
    where: { id: plan.id },
    include: { trainingTasks: { include: { checklistItems: true } }, calendarDrafts: true }
  });
}
```

`src/services/calendarDraftService.ts`:

```ts
import { prisma } from "@/src/db/client";

export async function listCalendarDrafts(userId: string) {
  return prisma.calendarEventDraft.findMany({
    where: { userId },
    orderBy: { startsAt: "asc" }
  });
}

export async function confirmCalendarDraft(userId: string, draftId: string) {
  const draft = await prisma.calendarEventDraft.findFirst({
    where: { id: draftId, userId }
  });
  if (!draft) throw new Error("Draft not found");

  return prisma.calendarEventDraft.update({
    where: { id: draft.id },
    data: {
      status: "confirmed",
      externalEventId: `mock-feishu-${draft.id}`,
      failureReason: null
    }
  });
}
```

- [ ] **Step 5: Implement API routes**

`app/api/sync/coros/route.ts`:

```ts
import { NextResponse } from "next/server";
import { requireUser } from "@/src/auth/session";
import { importCorosPayload } from "@/src/services/syncService";

export async function POST(request: Request) {
  const user = await requireUser();
  return NextResponse.json(await importCorosPayload(user.id, await request.json()));
}
```

`app/api/sync/calendar/route.ts`:

```ts
import { NextResponse } from "next/server";
import { requireUser } from "@/src/auth/session";
import { importCalendarPayload } from "@/src/services/syncService";

export async function POST(request: Request) {
  const user = await requireUser();
  return NextResponse.json(await importCalendarPayload(user.id, await request.json()));
}
```

`app/api/plan/generate/route.ts`:

```ts
import { NextResponse } from "next/server";
import { requireUser } from "@/src/auth/session";
import { generatePlanForUser } from "@/src/services/planService";

export async function POST(request: Request) {
  const user = await requireUser();
  const body = await request.json();
  const weekStart = new Date(body.weekStart);
  return NextResponse.json(await generatePlanForUser(user.id, weekStart));
}
```

`app/api/calendar/drafts/route.ts`:

```ts
import { NextResponse } from "next/server";
import { requireUser } from "@/src/auth/session";
import { listCalendarDrafts } from "@/src/services/calendarDraftService";

export async function GET() {
  const user = await requireUser();
  return NextResponse.json(await listCalendarDrafts(user.id));
}
```

`app/api/calendar/drafts/[id]/confirm/route.ts`:

```ts
import { NextResponse } from "next/server";
import { requireUser } from "@/src/auth/session";
import { confirmCalendarDraft } from "@/src/services/calendarDraftService";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await context.params;
  return NextResponse.json(await confirmCalendarDraft(user.id, id));
}
```

- [ ] **Step 6: Run tests**

Run:

```bash
npm test -- tests/planning/calendarDrafts.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/planning/calendarDrafts.ts src/services/syncService.ts src/services/planService.ts src/services/calendarDraftService.ts tests/planning/calendarDrafts.test.ts app/api/sync app/api/plan app/api/calendar
git commit -m "feat: add plan generation services"
```

---

### Task 10: Dashboard UI Pages

**Files:**
- Create: `app/(dashboard)/layout.tsx`
- Create: `app/(dashboard)/profile/page.tsx`
- Create: `app/(dashboard)/goals/page.tsx`
- Create: `app/(dashboard)/plan/page.tsx`
- Create: `components/ActionButton.tsx`
- Create: `components/MetricCard.tsx`
- Create: `components/NutritionPanel.tsx`
- Create: `components/ProfileForm.tsx`
- Create: `components/GoalForm.tsx`
- Create: `components/GeneratePlanButton.tsx`
- Create: `components/WeeklyPlan.tsx`
- Create: `components/Checklist.tsx`
- Create: `components/CalendarDraftList.tsx`

- [ ] **Step 1: Create shared dashboard layout**

`app/(dashboard)/layout.tsx`:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/src/auth/session";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div>
      <header style={{ borderBottom: "1px solid var(--line)", background: "var(--panel)" }}>
        <nav className="page" style={{ display: "flex", gap: 20, alignItems: "center" }}>
          <strong>Healthy Body Manager</strong>
          <Link href="/plan">Plan</Link>
          <Link href="/profile">Profile</Link>
          <Link href="/goals">Goals</Link>
          <Link href="/agent">Agent</Link>
        </nav>
      </header>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Create base components**

`components/ActionButton.tsx`:

```tsx
import type { ButtonHTMLAttributes } from "react";

export function ActionButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        border: 0,
        borderRadius: 8,
        padding: "10px 14px",
        color: "#fff",
        background: "var(--accent)",
        cursor: "pointer",
        ...props.style
      }}
    />
  );
}
```

`components/MetricCard.tsx`:

```tsx
export function MetricCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <section className="surface" style={{ padding: 16 }}>
      <div style={{ color: "var(--muted)", fontSize: 13 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{value}</div>
      {hint && <div style={{ color: "var(--muted)", marginTop: 6 }}>{hint}</div>}
    </section>
  );
}
```

`components/NutritionPanel.tsx`:

```tsx
type NutritionPanelProps = {
  nutrition: {
    calorieTarget: string;
    proteinTargetGrams: number;
    carbohydrateGuidance: string;
    recommended: Array<{ name: string; calories: number; proteinGrams: number }>;
    caution: Array<{ name: string; calories: number; fatGrams: number }>;
  } | null;
};

export function NutritionPanel({ nutrition }: NutritionPanelProps) {
  if (!nutrition) {
    return <section className="surface" style={{ padding: 20 }}>Generate a plan to see nutrition targets and menu recommendations.</section>;
  }

  return (
    <section className="surface" style={{ padding: 20 }}>
      <h2>Nutrition</h2>
      <p>Calories: {nutrition.calorieTarget}</p>
      <p>Protein target: {nutrition.proteinTargetGrams}g</p>
      <p>{nutrition.carbohydrateGuidance}</p>
      <h3>Recommended</h3>
      <ul>
        {nutrition.recommended.map((item) => (
          <li key={item.name}>{item.name} · {item.calories} kcal · {item.proteinGrams}g protein</li>
        ))}
      </ul>
      <h3>Use caution</h3>
      <ul>
        {nutrition.caution.map((item) => (
          <li key={item.name}>{item.name} · {item.calories} kcal · {item.fatGrams}g fat</li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 3: Create profile and goal forms**

`components/ProfileForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { ActionButton } from "@/components/ActionButton";

export function ProfileForm() {
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      heightCm: Number(form.get("heightCm")),
      weightKg: Number(form.get("weightKg")),
      sex: String(form.get("sex")),
      trainingExperience: String(form.get("trainingExperience")),
      injuries: String(form.get("injuries") ?? "").split(",").map((item) => item.trim()).filter(Boolean),
      dietaryPreferences: String(form.get("dietaryPreferences") ?? "").split(",").map((item) => item.trim()).filter(Boolean),
      trainingPreferences: String(form.get("trainingPreferences") ?? "").split(",").map((item) => item.trim()).filter(Boolean)
    };
    const response = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    setMessage(response.ok ? "Profile saved" : "Profile could not be saved");
  }

  return (
    <form className="surface" onSubmit={submit} style={{ padding: 20, display: "grid", gap: 12 }}>
      <input name="heightCm" type="number" placeholder="Height cm" required />
      <input name="weightKg" type="number" placeholder="Weight kg" required />
      <select name="sex" defaultValue="male">
        <option value="male">Male</option>
        <option value="female">Female</option>
        <option value="other">Other</option>
      </select>
      <select name="trainingExperience" defaultValue="intermediate">
        <option value="beginner">Beginner</option>
        <option value="intermediate">Intermediate</option>
        <option value="advanced">Advanced</option>
      </select>
      <input name="injuries" placeholder="Injuries, comma separated" />
      <input name="dietaryPreferences" placeholder="Dietary preferences, comma separated" />
      <input name="trainingPreferences" placeholder="Training preferences, comma separated" />
      <ActionButton type="submit"><Save size={16} /> Save profile</ActionButton>
      {message && <p>{message}</p>}
    </form>
  );
}
```

`components/GoalForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { ActionButton } from "@/components/ActionButton";

export function GoalForm() {
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      title: String(form.get("title")),
      type: String(form.get("type")),
      priority: Number(form.get("priority")),
      targetDate: String(form.get("targetDate") || ""),
      metrics: {}
    };
    const response = await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    setMessage(response.ok ? "Goal saved" : "Goal could not be saved");
  }

  return (
    <form className="surface" onSubmit={submit} style={{ padding: 20, display: "grid", gap: 12 }}>
      <input name="title" placeholder="Goal title" required />
      <select name="type" defaultValue="primary">
        <option value="primary">Primary</option>
        <option value="short_term_event">Short-term event</option>
        <option value="long_term">Long-term</option>
        <option value="secondary">Secondary</option>
      </select>
      <input name="priority" type="number" min="1" max="10" defaultValue="8" />
      <input name="targetDate" type="date" />
      <ActionButton type="submit"><Plus size={16} /> Add goal</ActionButton>
      {message && <p>{message}</p>}
    </form>
  );
}
```

- [ ] **Step 4: Create plan action and display components**

`components/GeneratePlanButton.tsx`:

```tsx
"use client";

import { RefreshCw } from "lucide-react";
import { ActionButton } from "@/components/ActionButton";

function mondayForCurrentWeek() {
  const today = new Date();
  const day = today.getDay() === 0 ? 7 : today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - day + 1);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export function GeneratePlanButton() {
  async function generate() {
    await fetch("/api/plan/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weekStart: mondayForCurrentWeek().toISOString() })
    });
    window.location.reload();
  }

  return (
    <ActionButton type="button" onClick={generate}>
      <RefreshCw size={16} /> Generate this week
    </ActionButton>
  );
}
```

`components/Checklist.tsx`:

```tsx
"use client";

import { useState } from "react";

export function Checklist({ taskId, items }: { taskId: string; items: Array<{ id: string; label: string; status: string }> }) {
  const [localItems, setLocalItems] = useState(items);

  async function toggle(itemId: string, checked: boolean) {
    const nextItems = localItems.map((item) => item.id === itemId ? { ...item, status: checked ? "completed" : "pending" } : item);
    setLocalItems(nextItems);
    await fetch(`/api/training/tasks/${taskId}/completion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: nextItems.map((item) => ({
          id: item.id,
          label: item.label,
          status: item.status
        }))
      })
    });
  }

  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
      {localItems.map((item) => (
        <li key={item.id} className="surface" style={{ padding: 12, display: "flex", alignItems: "center", gap: 10 }}>
          <input type="checkbox" checked={item.status === "completed"} onChange={(event) => toggle(item.id, event.target.checked)} />
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}
```

`components/WeeklyPlan.tsx`:

```tsx
import { Checklist } from "@/components/Checklist";

type WeeklyPlanProps = {
  plan: {
    summary: string;
    explanation: string;
    trainingTasks: Array<{
      id: string;
      title: string;
      intensity: string;
      durationMinutes: number;
      checklistItems: Array<{ id: string; label: string; status: string }>;
    }>;
    } | null;
};

export function WeeklyPlan({ plan }: WeeklyPlanProps) {
  if (!plan) {
    return <section className="surface" style={{ padding: 20 }}>Generate a plan after syncing profile, goals, and schedule data.</section>;
  }

  return (
    <section style={{ display: "grid", gap: 16 }}>
      <div className="surface" style={{ padding: 20 }}>
        <h2>{plan.summary}</h2>
        <p>{plan.explanation}</p>
      </div>
      {plan.trainingTasks.map((task) => (
        <article key={task.id} className="surface" style={{ padding: 20 }}>
          <h3>{task.title}</h3>
          <p>{task.durationMinutes} min · {task.intensity}</p>
          <Checklist taskId={task.id} items={task.checklistItems} />
        </article>
      ))}
    </section>
  );
}
```

`components/CalendarDraftList.tsx`:

```tsx
"use client";

import { CalendarCheck } from "lucide-react";
import { ActionButton } from "@/components/ActionButton";

export function CalendarDraftList({ drafts }: { drafts: Array<{ id: string; title: string; startsAt: Date; endsAt: Date; status: string }> }) {
  async function confirm(id: string) {
    await fetch(`/api/calendar/drafts/${id}/confirm`, { method: "POST" });
    window.location.reload();
  }

  return (
    <section className="surface" style={{ padding: 20 }}>
      <h2>Calendar drafts</h2>
      <div style={{ display: "grid", gap: 12 }}>
        {drafts.map((draft) => (
          <div key={draft.id} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <span>{draft.title} · {new Date(draft.startsAt).toLocaleString()}</span>
            <ActionButton type="button" onClick={() => confirm(draft.id)} disabled={draft.status !== "draft"}>
              <CalendarCheck size={16} /> {draft.status === "draft" ? "Confirm" : draft.status}
            </ActionButton>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Create pages**

`app/(dashboard)/profile/page.tsx`:

```tsx
import { MetricCard } from "@/components/MetricCard";
import { ProfileForm } from "@/components/ProfileForm";
import { requireUser } from "@/src/auth/session";
import { prisma } from "@/src/db/client";

export default async function ProfilePage() {
  const user = await requireUser();
  const [latestActivity, latestSleep, latestRecovery] = await Promise.all([
    prisma.activityRecord.findFirst({ where: { userId: user.id }, orderBy: { startedAt: "desc" } }),
    prisma.sleepRecord.findFirst({ where: { userId: user.id }, orderBy: { date: "desc" } }),
    prisma.recoveryRecord.findFirst({ where: { userId: user.id }, orderBy: { date: "desc" } })
  ]);

  return (
    <main className="page" style={{ display: "grid", gap: 20 }}>
      <h1>Body profile</h1>
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <MetricCard label="Latest workout" value={latestActivity ? latestActivity.sportType : "No data"} hint={latestActivity ? latestActivity.startedAt.toLocaleString() : "Sync COROS data"} />
        <MetricCard label="Sleep" value={latestSleep ? `${Math.round(latestSleep.durationMinutes / 60)}h` : "No data"} hint={latestSleep ? latestSleep.date.toDateString() : "Sync sleep data"} />
        <MetricCard label="Recovery" value={latestRecovery?.recoveryPercent ? `${latestRecovery.recoveryPercent}%` : "No data"} hint={latestRecovery ? latestRecovery.date.toDateString() : "Sync recovery data"} />
      </section>
      <ProfileForm />
    </main>
  );
}
```

`app/(dashboard)/goals/page.tsx`:

```tsx
import { GoalForm } from "@/components/GoalForm";

export default function GoalsPage() {
  return (
    <main className="page">
      <h1>Goals</h1>
      <GoalForm />
    </main>
  );
}
```

`app/(dashboard)/plan/page.tsx`:

```tsx
import { CalendarDraftList } from "@/components/CalendarDraftList";
import { GeneratePlanButton } from "@/components/GeneratePlanButton";
import { NutritionPanel } from "@/components/NutritionPanel";
import { WeeklyPlan } from "@/components/WeeklyPlan";
import { requireUser } from "@/src/auth/session";
import { prisma } from "@/src/db/client";

export default async function PlanPage() {
  const user = await requireUser();
  const plan = await prisma.plan.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { trainingTasks: { include: { checklistItems: true } } }
  });
  const drafts = await prisma.calendarEventDraft.findMany({
    where: { userId: user.id },
    orderBy: { startsAt: "asc" }
  });
  const nutrition = plan ? JSON.parse(plan.nutritionTargetsJson) : null;

  return (
    <main className="page" style={{ display: "grid", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center" }}>
        <h1>Plan</h1>
        <GeneratePlanButton />
      </div>
      <WeeklyPlan plan={plan} />
      <NutritionPanel nutrition={nutrition} />
      <CalendarDraftList drafts={drafts} />
    </main>
  );
}
```

- [ ] **Step 6: Run build**

Run:

```bash
npm run build
```

Expected: PASS and the dashboard pages compile.

- [ ] **Step 7: Commit**

```bash
git add app/'(dashboard)' components
git commit -m "feat: add dashboard pages"
```

---

### Task 11: Agent Conversation Shell

**Files:**
- Create: `src/services/agent.ts`
- Create: `tests/services/agent.test.ts`
- Create: `app/api/agent/route.ts`
- Create: `components/AgentPanel.tsx`
- Create: `app/(dashboard)/agent/page.tsx`

- [ ] **Step 1: Write failing agent tests**

`tests/services/agent.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createAgentResponse } from "@/src/services/agent";

describe("agent response shell", () => {
  it("routes sleep-related questions to a conservative training explanation", () => {
    const response = createAgentResponse("我昨晚没睡好，今天还适合跑吗？");
    expect(response.intent).toBe("recovery_check");
    expect(response.message).toContain("recovery");
  });

  it("routes calendar write requests to confirmation flow", () => {
    const response = createAgentResponse("帮我把本周训练写入飞书日历");
    expect(response.intent).toBe("calendar_confirmation");
  });
});
```

Run:

```bash
npm test -- tests/services/agent.test.ts
```

Expected: FAIL because agent service does not exist.

- [ ] **Step 2: Implement agent service**

`src/services/agent.ts`:

```ts
export type AgentIntent = "recovery_check" | "calendar_confirmation" | "menu_advice" | "replan" | "general";

export function createAgentResponse(message: string): { intent: AgentIntent; message: string } {
  if (/睡|sleep|恢复|recovery/.test(message)) {
    return {
      intent: "recovery_check",
      message: "I will check sleep and recovery first. If recovery is low, the plan should downgrade hard training to recovery work."
    };
  }

  if (/日历|calendar|写入|飞书/.test(message)) {
    return {
      intent: "calendar_confirmation",
      message: "I can prepare the training calendar drafts for review. Nothing is written until you confirm the drafts."
    };
  }

  if (/午餐|早餐|晚餐|menu|吃/.test(message)) {
    return {
      intent: "menu_advice",
      message: "I will compare today's menu with the training intensity and nutrition targets."
    };
  }

  if (/重新|调整|replan|改/.test(message)) {
    return {
      intent: "replan",
      message: "I can re-run the planning rules with the latest schedule, recovery, and completion data."
    };
  }

  return {
    intent: "general",
    message: "Ask me about today's training, menu choices, recovery, or calendar confirmation."
  };
}
```

- [ ] **Step 3: Implement Agent API and UI**

`app/api/agent/route.ts`:

```ts
import { NextResponse } from "next/server";
import { requireUser } from "@/src/auth/session";
import { prisma } from "@/src/db/client";
import { createAgentResponse } from "@/src/services/agent";

export async function POST(request: Request) {
  const user = await requireUser();
  const body = await request.json();
  const content = String(body.message ?? "");
  const response = createAgentResponse(content);

  await prisma.agentMessage.createMany({
    data: [
      { userId: user.id, role: "user", content, metadataJson: "{}" },
      { userId: user.id, role: "assistant", content: response.message, metadataJson: JSON.stringify({ intent: response.intent }) }
    ]
  });

  return NextResponse.json(response);
}
```

`components/AgentPanel.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { ActionButton } from "@/components/ActionButton";

export function AgentPanel() {
  const [message, setMessage] = useState("");
  const [responses, setResponses] = useState<string[]>([]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message })
    });
    const body = await response.json();
    setResponses((items) => [...items, body.message]);
    setMessage("");
  }

  return (
    <section className="surface" style={{ padding: 20, display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gap: 10 }}>
        {responses.map((response, index) => (
          <div key={index} className="surface" style={{ padding: 12 }}>{response}</div>
        ))}
      </div>
      <form onSubmit={send} style={{ display: "flex", gap: 10 }}>
        <input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Ask about training, recovery, calendar, or meals" style={{ flex: 1 }} />
        <ActionButton type="submit"><Send size={16} /> Send</ActionButton>
      </form>
    </section>
  );
}
```

`app/(dashboard)/agent/page.tsx`:

```tsx
import { AgentPanel } from "@/components/AgentPanel";

export default function AgentPage() {
  return (
    <main className="page">
      <h1>Agent</h1>
      <AgentPanel />
    </main>
  );
}
```

- [ ] **Step 4: Run tests and build**

Run:

```bash
npm test -- tests/services/agent.test.ts
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/agent.ts tests/services/agent.test.ts app/api/agent components/AgentPanel.tsx app/'(dashboard)'/agent/page.tsx
git commit -m "feat: add agent conversation shell"
```

---

### Task 12: Final Verification And README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create README**

`README.md`:

```md
# Healthy Body Manager

Healthy Body Manager is a personal training, recovery, schedule, and nutrition planning prototype.

## First Version

- Email/password login with user-scoped data.
- Body profile and goal management.
- COROS-style activity, sleep, and recovery import APIs.
- Feishu Calendar-style schedule import APIs.
- Rule-based weekly and daily training generation.
- Daily checklist and completion reconciliation.
- Mock menu recommendations.
- Calendar event drafts that require user confirmation.
- Agent conversation shell for explanation and workflow routing.

## Development

```bash
npm install
cp .env.example .env
npm run prisma:migrate -- --name init
npm run seed
npm run dev
```

Open `http://localhost:3000` and log in with:

- Email: `demo@example.com`
- Password: `healthy-body-demo`

## Verification

```bash
npm test
npm run build
```
```

- [ ] **Step 2: Run full verification**

Run:

```bash
npm test
npm run build
git status --short
```

Expected:

- All Vitest suites pass.
- Next.js production build passes.
- `git status --short` only shows files intentionally modified for this task before the final commit.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add project readme"
```

---

## Execution Notes

- Keep the deterministic planning rules conservative. When sleep, recovery, injury, or overload data is unfavorable, reduce intensity before trying to preserve the original plan.
- Keep provider payload parsing isolated in `src/providers/*`. Do not let raw COROS or Feishu field names leak into `src/planning/*`.
- The first calendar write-back implementation records confirmed drafts with mock external event ids behind the calendar provider boundary, so real Feishu MCP execution can be added without changing callers.
- The first Agent shell is intent routing plus persisted messages. It should explain and orchestrate; it must not generate unsafe plans outside the rule engine.
- Use the existing spec as the source of truth: `docs/superpowers/specs/2026-06-03-healthy-body-manager-design.md`.

## Self-Review Checklist

- Every acceptance criterion in the design spec maps to at least one task above.
- The plan starts with data and planning foundations before UI pages.
- Checklist completion and dynamic weekly adjustment are included as first-version work.
- Calendar write-back remains confirmation-first.
- Meal menu remains mock provider-based.
- Backend MCP host lifecycle is excluded from this implementation plan.
- No task depends on multi-user coach/team features.

Plan complete and saved to `docs/superpowers/plans/2026-06-03-healthy-body-manager-implementation.md`. Two execution options:

1. **Subagent-Driven (recommended)** - Dispatch a fresh subagent per task, review between tasks, fast iteration.

2. **Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
