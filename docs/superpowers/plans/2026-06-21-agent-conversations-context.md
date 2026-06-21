# Agent Conversations And Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build multi-conversation Agent chat with conversation-scoped history and intent-aware local data context, with live COROS sync only on explicit fresh-data requests.

**Architecture:** Add `AgentConversation` as the durable parent for `AgentMessage`, expose conversation CRUD routes, and make `/api/agent` require a user-owned `conversationId`. Add a focused `agentContext` service that reads local app data by intent and optionally refreshes COROS through the existing Settings-backed sync path before model prompting.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Prisma 6 with SQLite, Vitest, Testing Library.

---

## File Structure

- Modify `prisma/schema.prisma`: add `AgentConversation`, add `conversationId` relation to `AgentMessage`, add `User.agentConversations`.
- Create `prisma/migrations/20260621090000_agent_conversations/migration.sql`: create the conversation table, migrate existing messages into per-user legacy conversations, rebuild `AgentMessage` with the new required relation.
- Create `src/services/agentConversations.ts`: list, create, fetch, and title-update helpers with user ownership checks.
- Create `src/services/agentContext.ts`: intent-aware context builder plus explicit fresh-data detection.
- Modify `src/services/agent.ts`: accept `AgentContext`, include context in model prompts, preserve rule fallback.
- Modify `app/(dashboard)/agent/page.tsx`: load or create the selected conversation and pass conversation summaries to the client component.
- Create `app/api/agent/conversations/route.ts`: list and create current-user conversations.
- Create `app/api/agent/conversations/[id]/route.ts`: fetch one current-user conversation with messages.
- Modify `app/api/agent/route.ts`: validate `conversationId`, scope history and writes, update conversation title, pass context.
- Modify `components/AgentPanel.tsx`: render conversation rail, create/switch conversations, send selected `conversationId`.
- Modify `app/globals.css`: add responsive Agent workspace and conversation rail styles.
- Add or update tests in `tests/services/agentConversations.test.ts`, `tests/services/agentContext.test.ts`, `tests/services/agent.test.ts`, `tests/api/agent.test.ts`, and `tests/components/AgentPanel.test.tsx`.

Before implementation, run `git status --short` and keep unrelated dirty files out of every task commit. This repository currently has existing uncommitted work outside this plan.

---

### Task 1: Add Agent Conversation Persistence

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260621090000_agent_conversations/migration.sql`

- [ ] **Step 1: Update Prisma schema**

In `prisma/schema.prisma`, add the new relation on `User` near `agentMessages`:

```prisma
  agentConversations AgentConversation[]
  agentMessages       AgentMessage[]
```

Add this model before `AgentMessage`:

```prisma
model AgentConversation {
  id        String   @id @default(cuid())
  userId    String
  title     String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user     User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  messages AgentMessage[]

  @@index([userId, updatedAt])
  @@unique([id, userId])
}
```

Update `AgentMessage` to include `conversationId` and the compound relation:

```prisma
model AgentMessage {
  id             String   @id @default(cuid())
  userId         String
  conversationId String
  role           String
  content        String
  metadataJson   String
  createdAt      DateTime @default(now())

  user         User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  conversation AgentConversation @relation(fields: [conversationId, userId], references: [id, userId], onDelete: Cascade)

  @@index([userId, createdAt])
  @@index([conversationId, createdAt])
}
```

- [ ] **Step 2: Create migration SQL**

Create `prisma/migrations/20260621090000_agent_conversations/migration.sql` with:

```sql
PRAGMA foreign_keys=OFF;

CREATE TABLE "AgentConversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AgentConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "AgentConversation" ("id", "userId", "title", "createdAt", "updatedAt")
SELECT
    'legacy-' || "userId",
    "userId",
    'Previous conversation',
    MIN("createdAt"),
    MAX("createdAt")
FROM "AgentMessage"
GROUP BY "userId";

CREATE TABLE "new_AgentMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadataJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AgentMessage_conversationId_userId_fkey" FOREIGN KEY ("conversationId", "userId") REFERENCES "AgentConversation" ("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_AgentMessage" ("id", "userId", "conversationId", "role", "content", "metadataJson", "createdAt")
SELECT "id", "userId", 'legacy-' || "userId", "role", "content", "metadataJson", "createdAt"
FROM "AgentMessage";

DROP TABLE "AgentMessage";
ALTER TABLE "new_AgentMessage" RENAME TO "AgentMessage";

CREATE INDEX "AgentConversation_userId_updatedAt_idx" ON "AgentConversation"("userId", "updatedAt");
CREATE UNIQUE INDEX "AgentConversation_id_userId_key" ON "AgentConversation"("id", "userId");
CREATE INDEX "AgentMessage_userId_createdAt_idx" ON "AgentMessage"("userId", "createdAt");
CREATE INDEX "AgentMessage_conversationId_createdAt_idx" ON "AgentMessage"("conversationId", "createdAt");

PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
```

- [ ] **Step 3: Generate Prisma client**

Run: `npm run prisma:generate`

Expected: PASS and Prisma Client generated with `agentConversation`.

- [ ] **Step 4: Run full test suite once**

Run: `npm test`

Expected: Existing Agent API/component tests fail because the runtime still uses user-global messages and `AgentPanel` does not accept conversation props. Non-Agent failures that existed before this task should be noted separately and not fixed in this task.

- [ ] **Step 5: Commit persistence changes**

```bash
git add prisma/schema.prisma prisma/migrations/20260621090000_agent_conversations/migration.sql
git commit -m "feat: add agent conversation persistence"
```

---

### Task 2: Add Conversation Service And Routes

**Files:**
- Create: `src/services/agentConversations.ts`
- Create: `app/api/agent/conversations/route.ts`
- Create: `app/api/agent/conversations/[id]/route.ts`
- Test: `tests/services/agentConversations.test.ts`

- [ ] **Step 1: Write failing service tests**

Create `tests/services/agentConversations.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAgentConversation,
  getAgentConversationForUser,
  listAgentConversations,
  titleFromFirstMessage
} from "@/src/services/agentConversations";
import { prisma } from "@/src/db/client";

vi.mock("@/src/db/client", () => ({
  prisma: {
    agentConversation: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn()
    }
  }
}));

describe("agent conversation service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists current-user conversations newest first", async () => {
    vi.mocked(prisma.agentConversation.findMany).mockResolvedValue([
      { id: "conv-2", title: "Today", updatedAt: new Date("2026-06-21T09:00:00+08:00") }
    ] as never);

    await expect(listAgentConversations("user-1")).resolves.toEqual([
      { id: "conv-2", title: "Today", updatedAt: "2026-06-21T01:00:00.000Z" }
    ]);
    expect(prisma.agentConversation.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      orderBy: { updatedAt: "desc" },
      take: 30,
      select: { id: true, title: true, updatedAt: true }
    });
  });

  it("creates an empty current-user conversation", async () => {
    vi.mocked(prisma.agentConversation.create).mockResolvedValue({
      id: "conv-new",
      title: "New conversation",
      updatedAt: new Date("2026-06-21T09:30:00+08:00")
    } as never);

    await expect(createAgentConversation("user-1")).resolves.toEqual({
      id: "conv-new",
      title: "New conversation",
      updatedAt: "2026-06-21T01:30:00.000Z",
      messages: []
    });
  });

  it("fetches one conversation only when it belongs to the user", async () => {
    vi.mocked(prisma.agentConversation.findFirst).mockResolvedValue({
      id: "conv-1",
      title: "Recovery",
      updatedAt: new Date("2026-06-21T09:30:00+08:00"),
      messages: [{ id: "msg-1", role: "user", content: "最新恢复怎么样？" }]
    } as never);

    await expect(getAgentConversationForUser("user-1", "conv-1")).resolves.toEqual({
      id: "conv-1",
      title: "Recovery",
      updatedAt: "2026-06-21T01:30:00.000Z",
      messages: [{ id: "msg-1", role: "user", content: "最新恢复怎么样？" }]
    });
  });

  it("builds compact titles from first user messages", () => {
    expect(titleFromFirstMessage("  最新恢复情况怎么样？今天能不能跑  ")).toBe("最新恢复情况怎么样？今天能不能跑");
    expect(titleFromFirstMessage("a".repeat(80))).toBe(`${"a".repeat(46)}...`);
    expect(titleFromFirstMessage("")).toBe("New conversation");
  });
});
```

- [ ] **Step 2: Run service tests and verify failure**

Run: `npm test -- tests/services/agentConversations.test.ts`

Expected: FAIL because `src/services/agentConversations.ts` does not exist.

- [ ] **Step 3: Implement conversation service**

Create `src/services/agentConversations.ts`:

```ts
import { prisma } from "@/src/db/client";

export type AgentConversationSummary = {
  id: string;
  title: string;
  updatedAt: string;
};

export type AgentConversationMessage = {
  id: string;
  role: string;
  content: string;
};

export type AgentConversationDetail = AgentConversationSummary & {
  messages: AgentConversationMessage[];
};

function serializeSummary(conversation: { id: string; title: string; updatedAt: Date }): AgentConversationSummary {
  return {
    id: conversation.id,
    title: conversation.title,
    updatedAt: conversation.updatedAt.toISOString()
  };
}

export function titleFromFirstMessage(message: string) {
  const normalized = message.trim().replace(/\s+/g, " ");
  if (!normalized) return "New conversation";
  return normalized.length > 49 ? `${normalized.slice(0, 46)}...` : normalized;
}

export async function listAgentConversations(userId: string): Promise<AgentConversationSummary[]> {
  const conversations = await prisma.agentConversation.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: 30,
    select: { id: true, title: true, updatedAt: true }
  });

  return conversations.map(serializeSummary);
}

export async function createAgentConversation(userId: string): Promise<AgentConversationDetail> {
  const conversation = await prisma.agentConversation.create({
    data: { userId, title: "New conversation" },
    select: { id: true, title: true, updatedAt: true }
  });

  return { ...serializeSummary(conversation), messages: [] };
}

export async function getAgentConversationForUser(userId: string, conversationId: string): Promise<AgentConversationDetail | null> {
  const conversation = await prisma.agentConversation.findFirst({
    where: { id: conversationId, userId },
    select: {
      id: true,
      title: true,
      updatedAt: true,
      messages: {
        orderBy: { createdAt: "asc" },
        take: 100,
        select: { id: true, role: true, content: true }
      }
    }
  });

  if (!conversation) return null;
  return { ...serializeSummary(conversation), messages: conversation.messages };
}
```

- [ ] **Step 4: Add conversation API routes**

Create `app/api/agent/conversations/route.ts`:

```ts
import { NextResponse } from "next/server";
import { withUser } from "@/src/auth/api";
import { createAgentConversation, listAgentConversations } from "@/src/services/agentConversations";

export const GET = withUser(async (user) => NextResponse.json(await listAgentConversations(user.id)));

export const POST = withUser(async (user) => NextResponse.json(await createAgentConversation(user.id), { status: 201 }));
```

Create `app/api/agent/conversations/[id]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { withUser } from "@/src/auth/api";
import { getAgentConversationForUser } from "@/src/services/agentConversations";

export const GET = withUser(async (user, _request: Request, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  const conversation = await getAgentConversationForUser(user.id, id);
  if (!conversation) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  return NextResponse.json(conversation);
});
```

- [ ] **Step 5: Run service tests**

Run: `npm test -- tests/services/agentConversations.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit conversation service and routes**

```bash
git add src/services/agentConversations.ts app/api/agent/conversations/route.ts 'app/api/agent/conversations/[id]/route.ts' tests/services/agentConversations.test.ts
git commit -m "feat: add agent conversation APIs"
```

---

### Task 3: Scope Agent API To The Selected Conversation

**Files:**
- Modify: `app/api/agent/route.ts`
- Modify: `src/services/agentConversations.ts`
- Test: `tests/api/agent.test.ts`

- [ ] **Step 1: Write failing API tests**

Extend `tests/api/agent.test.ts` so the Prisma mock includes `agentConversation.update` and `agentConversation.findFirst`. Add these tests:

```ts
it("rejects missing conversation id", async () => {
  const response = await POST(
    new Request("http://localhost/api/agent", {
      method: "POST",
      body: JSON.stringify({ message: "今天怎么训练？" })
    })
  );

  expect(response.status).toBe(400);
  await expect(response.json()).resolves.toEqual({ error: "Conversation is required" });
});

it("rejects a conversation that does not belong to the user", async () => {
  vi.mocked(prisma.agentConversation.findFirst).mockResolvedValue(null);

  const response = await POST(
    new Request("http://localhost/api/agent", {
      method: "POST",
      body: JSON.stringify({ conversationId: "conv-other", message: "今天怎么训练？" })
    })
  );

  expect(response.status).toBe(404);
  await expect(response.json()).resolves.toEqual({ error: "Conversation not found" });
});

it("uses only selected conversation history and persists messages there", async () => {
  vi.mocked(prisma.agentConversation.findFirst).mockResolvedValue({ id: "conv-1", title: "New conversation" } as never);
  vi.mocked(prisma.agentMessage.findMany).mockResolvedValue([{ role: "assistant", content: "上一次回复" }] as never);
  vi.mocked(prisma.agentMessage.createMany).mockResolvedValue({ count: 2 } as never);
  vi.mocked(prisma.agentConversation.update).mockResolvedValue({ id: "conv-1", title: "今天怎么训练？" } as never);
  vi.mocked(createAgentResponseForUser).mockResolvedValue({
    intent: "general",
    message: "模型回复",
    source: "model",
    modelProvider: "DeepSeek",
    modelName: "deepseek-v4-flash"
  });

  const response = await POST(
    new Request("http://localhost/api/agent", {
      method: "POST",
      body: JSON.stringify({ conversationId: "conv-1", message: "今天怎么训练？" })
    })
  );

  expect(prisma.agentMessage.findMany).toHaveBeenCalledWith({
    where: { userId: "user-1", conversationId: "conv-1" },
    orderBy: { createdAt: "desc" },
    take: 8
  });
  expect(prisma.agentMessage.createMany).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.arrayContaining([
        expect.objectContaining({ userId: "user-1", conversationId: "conv-1", role: "user" }),
        expect.objectContaining({ userId: "user-1", conversationId: "conv-1", role: "assistant" })
      ])
    })
  );
  expect(await response.json()).toEqual(expect.objectContaining({ message: "模型回复", conversation: expect.objectContaining({ id: "conv-1" }) }));
});
```

- [ ] **Step 2: Run API tests and verify failure**

Run: `npm test -- tests/api/agent.test.ts`

Expected: FAIL because `/api/agent` does not validate or use `conversationId`.

- [ ] **Step 3: Add ownership and title helpers**

Append to `src/services/agentConversations.ts`:

```ts
export async function getAgentConversationSummaryForUser(userId: string, conversationId: string) {
  const conversation = await prisma.agentConversation.findFirst({
    where: { id: conversationId, userId },
    select: { id: true, title: true, updatedAt: true }
  });

  return conversation ? serializeSummary(conversation) : null;
}

export async function touchAgentConversationAfterMessage(userId: string, conversationId: string, title?: string) {
  const conversation = await prisma.agentConversation.update({
    where: { id_userId: { id: conversationId, userId } },
    data: {
      ...(title ? { title } : {}),
      updatedAt: new Date()
    },
    select: { id: true, title: true, updatedAt: true }
  });

  return serializeSummary(conversation);
}
```

- [ ] **Step 4: Update `/api/agent`**

Replace the handler body in `app/api/agent/route.ts` with conversation-scoped logic:

```ts
export const POST = withUser(async (user, request: Request) => {
  const body = await request.json();
  const content = String(body.message ?? "").trim();
  const conversationId = String(body.conversationId ?? "").trim();

  if (!content) return NextResponse.json({ error: "Message is required" }, { status: 400 });
  if (!conversationId) return NextResponse.json({ error: "Conversation is required" }, { status: 400 });

  const conversation = await getAgentConversationSummaryForUser(user.id, conversationId);
  if (!conversation) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

  const history = await prisma.agentMessage.findMany({
    where: { userId: user.id, conversationId },
    orderBy: { createdAt: "desc" },
    take: 8
  });
  const response = await createAgentResponseForUser(
    user.id,
    content,
    history.reverse().map((message) => ({ role: message.role, content: message.content }))
  );

  await prisma.agentMessage.createMany({
    data: [
      { userId: user.id, conversationId, role: "user", content, metadataJson: "{}" },
      {
        userId: user.id,
        conversationId,
        role: "assistant",
        content: response.message,
        metadataJson: JSON.stringify({
          intent: response.intent,
          source: response.source,
          modelProvider: response.modelProvider,
          modelName: response.modelName,
          error: response.error
        })
      }
    ]
  });

  const nextTitle = conversation.title === "New conversation" && history.length === 0 ? titleFromFirstMessage(content) : undefined;
  const updatedConversation = await touchAgentConversationAfterMessage(user.id, conversationId, nextTitle);

  return NextResponse.json({ ...response, conversation: updatedConversation });
});
```

Add these imports:

```ts
import {
  getAgentConversationSummaryForUser,
  titleFromFirstMessage,
  touchAgentConversationAfterMessage
} from "@/src/services/agentConversations";
```

- [ ] **Step 5: Run API tests**

Run: `npm test -- tests/api/agent.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit scoped Agent API**

```bash
git add app/api/agent/route.ts src/services/agentConversations.ts tests/api/agent.test.ts
git commit -m "feat: scope agent chat by conversation"
```

---

### Task 4: Add Intent-Aware Agent Context And Fresh Sync

**Files:**
- Create: `src/services/agentContext.ts`
- Modify: `src/services/agent.ts`
- Modify: `app/api/agent/route.ts`
- Test: `tests/services/agentContext.test.ts`
- Test: `tests/services/agent.test.ts`

- [ ] **Step 1: Write failing context tests**

Create `tests/services/agentContext.test.ts` with mocked `prisma` and `syncCorosFromSettings`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildAgentContext, shouldRefreshCoros } from "@/src/services/agentContext";
import { prisma } from "@/src/db/client";
import { syncCorosFromSettings } from "@/src/services/syncService";

vi.mock("@/src/services/syncService", () => ({ syncCorosFromSettings: vi.fn() }));

vi.mock("@/src/db/client", () => ({
  prisma: {
    bodyProfile: { findUnique: vi.fn() },
    goal: { findMany: vi.fn() },
    activityRecord: { findMany: vi.fn() },
    sleepRecord: { findMany: vi.fn() },
    recoveryRecord: { findMany: vi.fn() },
    plan: { findFirst: vi.fn() },
    calendarSnapshot: { findFirst: vi.fn() },
    calendarEventDraft: { findMany: vi.fn() }
  }
}));

describe("agent context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.bodyProfile.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.goal.findMany).mockResolvedValue([]);
    vi.mocked(prisma.activityRecord.findMany).mockResolvedValue([]);
    vi.mocked(prisma.sleepRecord.findMany).mockResolvedValue([]);
    vi.mocked(prisma.recoveryRecord.findMany).mockResolvedValue([]);
    vi.mocked(prisma.plan.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.calendarSnapshot.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.calendarEventDraft.findMany).mockResolvedValue([]);
  });

  it("detects explicit fresh-data phrases", () => {
    expect(shouldRefreshCoros("同步一下最新 COROS 数据")).toBe(true);
    expect(shouldRefreshCoros("pull latest recovery")).toBe(true);
    expect(shouldRefreshCoros("我昨晚没睡好，今天还适合跑吗？")).toBe(false);
  });

  it("loads recovery context without live sync by default", async () => {
    vi.mocked(prisma.sleepRecord.findMany).mockResolvedValue([
      { date: new Date("2026-06-20T00:00:00+08:00"), durationMinutes: 390, qualityScore: 72 }
    ] as never);
    vi.mocked(prisma.recoveryRecord.findMany).mockResolvedValue([
      { date: new Date("2026-06-20T00:00:00+08:00"), recoveryPercent: 64, hrvMs: 45, restingHeartRateBpm: 58 }
    ] as never);

    const context = await buildAgentContext("user-1", "recovery_check", "我昨晚没睡好，今天还适合跑吗？");

    expect(syncCorosFromSettings).not.toHaveBeenCalled();
    expect(context.freshSync).toEqual({ attempted: false, succeeded: false });
    expect(context.sections.map((section) => section.title)).toContain("Recent sleep");
    expect(context.sections.map((section) => section.title)).toContain("Recent recovery");
  });

  it("runs COROS sync only when latest data is requested", async () => {
    vi.mocked(syncCorosFromSettings).mockResolvedValue({ activities: 1, sleep: 1, recovery: 1 });

    const context = await buildAgentContext("user-1", "recovery_check", "同步一下最新恢复数据");

    expect(syncCorosFromSettings).toHaveBeenCalledWith("user-1");
    expect(context.freshSync).toEqual({ attempted: true, succeeded: true });
  });

  it("keeps local context when COROS sync fails", async () => {
    vi.mocked(syncCorosFromSettings).mockRejectedValue(new Error("COROS MCP endpoint is not configured."));

    const context = await buildAgentContext("user-1", "recovery_check", "拉取最新恢复数据");

    expect(context.freshSync).toEqual({
      attempted: true,
      succeeded: false,
      error: "COROS MCP endpoint is not configured."
    });
  });
});
```

- [ ] **Step 2: Run context tests and verify failure**

Run: `npm test -- tests/services/agentContext.test.ts`

Expected: FAIL because `src/services/agentContext.ts` does not exist.

- [ ] **Step 3: Implement context builder**

Create `src/services/agentContext.ts`:

```ts
import type { AgentIntent } from "@/src/services/agent";
import { prisma } from "@/src/db/client";
import { syncCorosFromSettings } from "@/src/services/syncService";

export type AgentContext = {
  intent: AgentIntent;
  freshSync: {
    attempted: boolean;
    succeeded: boolean;
    error?: string;
  };
  sections: Array<{ title: string; content: string }>;
};

export function shouldRefreshCoros(message: string) {
  return /最新|同步|拉取|刚刚|现在的数据|latest|sync|refresh|pull latest/i.test(message);
}

function formatDate(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : "unknown date";
}

function section(title: string, lines: string[]) {
  const content = lines.filter(Boolean).join("\n");
  return { title, content: content || "No synced data available." };
}

async function loadCommonContext(userId: string) {
  const [profile, goals] = await Promise.all([
    prisma.bodyProfile.findUnique({ where: { userId } }),
    prisma.goal.findMany({ where: { userId, status: "active" }, orderBy: { priority: "desc" }, take: 5 })
  ]);

  return [
    section("Body profile", [
      profile
        ? `Height ${profile.heightCm} cm, weight ${profile.weightKg} kg, experience ${profile.trainingExperience}, resting HR ${profile.restingHeartRateBpm ?? "unknown"}.`
        : "No body profile saved.",
      goals.length > 0 ? `Active goals: ${goals.map((goal) => `${goal.title} priority ${goal.priority}`).join("; ")}.` : "No active goals saved."
    ])
  ];
}

async function loadRecoveryContext(userId: string) {
  const [sleep, recovery, activities] = await Promise.all([
    prisma.sleepRecord.findMany({ where: { userId }, orderBy: { date: "desc" }, take: 5 }),
    prisma.recoveryRecord.findMany({ where: { userId }, orderBy: { date: "desc" }, take: 5 }),
    prisma.activityRecord.findMany({ where: { userId }, orderBy: { startedAt: "desc" }, take: 5 })
  ]);

  return [
    section(
      "Recent sleep",
      sleep.map((item) => `${formatDate(item.date)}: ${item.durationMinutes} min, score ${item.qualityScore ?? "unknown"}.`)
    ),
    section(
      "Recent recovery",
      recovery.map(
        (item) =>
          `${formatDate(item.date)}: recovery ${item.recoveryPercent ?? "unknown"}%, HRV ${item.hrvMs ?? "unknown"}, resting HR ${item.restingHeartRateBpm ?? "unknown"}.`
      )
    ),
    section(
      "Recent activities",
      activities.map((item) => `${formatDate(item.startedAt)}: ${item.sportType}, ${item.durationMinutes} min, intensity ${item.intensity}.`)
    )
  ];
}

async function loadPlanContext(userId: string) {
  const [plan, calendarSnapshot, drafts] = await Promise.all([
    prisma.plan.findFirst({
      where: { userId, status: { not: "superseded" } },
      orderBy: { weekStart: "desc" },
      include: { trainingTasks: { orderBy: { date: "asc" }, take: 14 } }
    }),
    prisma.calendarSnapshot.findFirst({ where: { userId }, orderBy: { capturedAt: "desc" } }),
    prisma.calendarEventDraft.findMany({ where: { userId, status: "draft" }, orderBy: { startsAt: "asc" }, take: 10 })
  ]);

  return [
    section("Latest plan", [
      plan ? `${plan.summary}\nTasks: ${plan.trainingTasks.map((task) => `${formatDate(task.date)} ${task.title} ${task.intensity}`).join("; ")}` : "No active plan found."
    ]),
    section("Calendar snapshot", [
      calendarSnapshot
        ? `Calendar snapshot covers ${formatDate(calendarSnapshot.rangeStart)} to ${formatDate(calendarSnapshot.rangeEnd)}.`
        : "No calendar snapshot synced."
    ]),
    section("Calendar drafts", drafts.map((draft) => `${formatDate(draft.startsAt)} ${draft.title} ${draft.status}.`))
  ];
}

async function loadMenuContext(userId: string) {
  const plan = await prisma.plan.findFirst({
    where: { userId, status: { not: "superseded" } },
    orderBy: { weekStart: "desc" },
    select: { nutritionTargetsJson: true, menuRecommendationsJson: true, summary: true }
  });

  return [
    section("Nutrition plan", [
      plan
        ? `Plan summary: ${plan.summary}\nNutrition targets: ${plan.nutritionTargetsJson}\nMenu recommendations: ${plan.menuRecommendationsJson}`
        : "No nutrition plan generated."
    ])
  ];
}

export async function buildAgentContext(userId: string, intent: AgentIntent, message: string): Promise<AgentContext> {
  const freshSync = shouldRefreshCoros(message)
    ? await syncCorosFromSettings(userId)
        .then(() => ({ attempted: true, succeeded: true }))
        .catch((error) => ({
          attempted: true,
          succeeded: false,
          error: error instanceof Error ? error.message : "COROS sync failed."
        }))
    : { attempted: false, succeeded: false };

  const common = await loadCommonContext(userId);
  const specific =
    intent === "recovery_check"
      ? await loadRecoveryContext(userId)
      : intent === "calendar_confirmation" || intent === "replan"
        ? await loadPlanContext(userId)
        : intent === "menu_advice"
          ? await loadMenuContext(userId)
          : [];

  return { intent, freshSync, sections: [...common, ...specific] };
}
```

- [ ] **Step 4: Update Agent model prompt tests**

In `tests/services/agent.test.ts`, add a test that passes context and asserts the OpenAI-compatible request body contains context text:

```ts
it("includes app context in configured model prompts", async () => {
  vi.mocked(loadModelRuntimeConfig).mockResolvedValue({
    provider: "deepseek",
    providerLabel: "DeepSeek",
    modelName: "deepseek-v4-flash",
    baseUrl: "https://api.deepseek.com",
    apiKey: "sk-configured"
  });
  vi.mocked(fetch).mockResolvedValue({
    ok: true,
    json: async () => ({ choices: [{ message: { content: "建议今天降强度。" } }] })
  } as never);

  await createAgentResponseForUser("user-1", "今天能跑吗？", [], {
    intent: "recovery_check",
    freshSync: { attempted: true, succeeded: false, error: "COROS MCP endpoint is not configured." },
    sections: [{ title: "Recent recovery", content: "2026-06-20: recovery 64%, HRV 45." }]
  });

  const payload = JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body));
  expect(payload.messages[0].content).toContain("Recent recovery");
  expect(payload.messages[0].content).toContain("COROS MCP endpoint is not configured");
});
```

- [ ] **Step 5: Update Agent service**

In `src/services/agent.ts`, import the context type:

```ts
import type { AgentContext } from "@/src/services/agentContext";
```

Add a formatter:

```ts
function formatAgentContext(context?: AgentContext) {
  if (!context) return "No app context was loaded for this response.";
  const freshSync = context.freshSync.attempted
    ? context.freshSync.succeeded
      ? "Fresh COROS sync succeeded during this request."
      : `Fresh COROS sync failed during this request: ${context.freshSync.error ?? "Unknown error."}`
    : "No live COROS sync was requested during this response.";

  return [
    freshSync,
    ...context.sections.map((item) => `## ${item.title}\n${item.content}`)
  ].join("\n\n");
}
```

Change `systemPrompt(intent: AgentIntent)` to `systemPrompt(intent: AgentIntent, context?: AgentContext)` and include:

```ts
    "Use the app context below when it is available. Do not invent missing data.",
    "Do not claim latest COROS data unless the context says fresh COROS sync succeeded during this request.",
    "Do not claim that you wrote to calendars, changed plans, or fetched external data unless the app explicitly provides that result.",
    `App context:\n${formatAgentContext(context)}`,
```

Update `callAnthropicModel`, `callOpenAiCompatibleModel`, `callConfiguredModel`, and `createAgentResponseForUser` to accept `context?: AgentContext` and pass it into `systemPrompt`.

- [ ] **Step 6: Build context in `/api/agent`**

In `app/api/agent/route.ts`, import `buildAgentContext` and `createAgentResponse`:

```ts
import { createAgentResponse, createAgentResponseForUser } from "@/src/services/agent";
import { buildAgentContext } from "@/src/services/agentContext";
```

Before calling `createAgentResponseForUser`, route the intent once and build context:

```ts
  const routed = createAgentResponse(content);
  const agentContext = await buildAgentContext(user.id, routed.intent, content);
  const response = await createAgentResponseForUser(
    user.id,
    content,
    history.reverse().map((message) => ({ role: message.role, content: message.content })),
    agentContext
  );
```

Include fresh sync metadata in assistant `metadataJson`:

```ts
          freshSync: agentContext.freshSync,
          contextSections: agentContext.sections.map((section) => section.title),
```

- [ ] **Step 7: Run context and Agent tests**

Run: `npm test -- tests/services/agentContext.test.ts tests/services/agent.test.ts tests/api/agent.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit context-aware Agent response**

```bash
git add src/services/agentContext.ts src/services/agent.ts app/api/agent/route.ts tests/services/agentContext.test.ts tests/services/agent.test.ts tests/api/agent.test.ts
git commit -m "feat: load agent context by intent"
```

---

### Task 5: Build Multi-Conversation Agent UI

**Files:**
- Modify: `app/(dashboard)/agent/page.tsx`
- Modify: `components/AgentPanel.tsx`
- Modify: `app/globals.css`
- Test: `tests/components/AgentPanel.test.tsx`

- [ ] **Step 1: Write failing component tests**

Update `tests/components/AgentPanel.test.tsx` to render conversations and assert switching, creation, and send payloads:

```ts
const conversations = [
  { id: "conv-1", title: "Recovery", updatedAt: "2026-06-21T01:00:00.000Z" },
  { id: "conv-2", title: "Calendar", updatedAt: "2026-06-20T01:00:00.000Z" }
];

it("renders conversation list and selected messages", () => {
  render(
    <AgentPanel
      initialConversations={conversations}
      initialConversationId="conv-1"
      initialMessages={[{ id: "msg-1", role: "assistant", content: "Recovery answer" }]}
    />
  );

  expect(screen.getByRole("button", { name: "New chat" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Recovery" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByText("Recovery answer")).toBeInTheDocument();
});

it("loads messages when switching conversations", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe("/api/agent/conversations/conv-2");
      return {
        ok: true,
        json: async () => ({
          id: "conv-2",
          title: "Calendar",
          updatedAt: "2026-06-20T01:00:00.000Z",
          messages: [{ id: "msg-2", role: "assistant", content: "Calendar answer" }]
        })
      };
    })
  );

  render(<AgentPanel initialConversations={conversations} initialConversationId="conv-1" initialMessages={[]} />);
  fireEvent.click(screen.getByRole("button", { name: "Calendar" }));

  await waitFor(() => expect(screen.getByText("Calendar answer")).toBeInTheDocument());
  vi.unstubAllGlobals();
});

it("creates and selects a new conversation", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        id: "conv-new",
        title: "New conversation",
        updatedAt: "2026-06-21T02:00:00.000Z",
        messages: []
      })
    }))
  );

  render(<AgentPanel initialConversations={conversations} initialConversationId="conv-1" initialMessages={[]} />);
  fireEvent.click(screen.getByRole("button", { name: "New chat" }));

  await waitFor(() => expect(screen.getByRole("button", { name: "New conversation" })).toHaveAttribute("aria-pressed", "true"));
  vi.unstubAllGlobals();
});

it("sends messages with the selected conversation id", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("/api/agent");
      expect(JSON.parse(String(init?.body))).toEqual({ conversationId: "conv-1", message: "测试消息位置" });
      return {
        ok: true,
        json: async () => ({
          message: "Assistant reply",
          conversation: { id: "conv-1", title: "测试消息位置", updatedAt: "2026-06-21T02:00:00.000Z" }
        })
      };
    })
  );

  render(<AgentPanel initialConversations={conversations} initialConversationId="conv-1" initialMessages={[]} />);
  fireEvent.change(screen.getByPlaceholderText("Ask about training, recovery, calendar, or meals"), {
    target: { value: "测试消息位置" }
  });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));

  await waitFor(() => expect(screen.getByText("Assistant reply")).toBeInTheDocument());
  vi.unstubAllGlobals();
});
```

- [ ] **Step 2: Run component tests and verify failure**

Run: `npm test -- tests/components/AgentPanel.test.tsx`

Expected: FAIL because `AgentPanel` only accepts `initialMessages`.

- [ ] **Step 3: Update server Agent page**

In `app/(dashboard)/agent/page.tsx`, load or create a selected conversation:

```tsx
import { AgentPanel } from "@/components/AgentPanel";
import { requireUser } from "@/src/auth/session";
import { prisma } from "@/src/db/client";

export default async function AgentPage() {
  const user = await requireUser();
  let conversations = await prisma.agentConversation.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    take: 30,
    select: { id: true, title: true, updatedAt: true }
  });

  if (conversations.length === 0) {
    const created = await prisma.agentConversation.create({
      data: { userId: user.id, title: "New conversation" },
      select: { id: true, title: true, updatedAt: true }
    });
    conversations = [created];
  }

  const selectedConversation = conversations[0];
  const messages = await prisma.agentMessage.findMany({
    where: { userId: user.id, conversationId: selectedConversation.id },
    orderBy: { createdAt: "asc" },
    take: 100
  });

  return (
    <main className="page grid" style={{ gap: 20 }}>
      <div className="page-header">
        <div>
          <span className="eyebrow">Health advisor</span>
          <h1>Agent</h1>
          <p className="page-subtitle">Explain plans, check recovery, prepare calendar drafts, and route replanning requests.</p>
        </div>
      </div>
      <AgentPanel
        initialConversations={conversations.map((conversation) => ({
          id: conversation.id,
          title: conversation.title,
          updatedAt: conversation.updatedAt.toISOString()
        }))}
        initialConversationId={selectedConversation.id}
        initialMessages={messages.map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content
        }))}
      />
    </main>
  );
}
```

- [ ] **Step 4: Update `AgentPanel` props and state**

In `components/AgentPanel.tsx`, add these types:

```ts
type AgentConversationSummary = {
  id: string;
  title: string;
  updatedAt: string;
};

type AgentPanelProps = {
  initialConversations: AgentConversationSummary[];
  initialConversationId: string;
  initialMessages: ChatMessage[];
};
```

Change the component signature:

```ts
export function AgentPanel({ initialConversations, initialConversationId, initialMessages }: AgentPanelProps) {
```

Add state:

```ts
  const [conversations, setConversations] = useState(initialConversations);
  const [selectedConversationId, setSelectedConversationId] = useState(initialConversationId);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [error, setError] = useState("");
```

Add `selectConversation`:

```ts
  async function selectConversation(conversationId: string) {
    if (conversationId === selectedConversationId || loadingConversation) return;
    setLoadingConversation(true);
    setError("");
    const response = await fetch(`/api/agent/conversations/${conversationId}`);
    const body = await response.json();
    if (response.ok) {
      setSelectedConversationId(body.id);
      setMessages(body.messages);
      setConversations((items) =>
        items.map((item) => (item.id === body.id ? { id: body.id, title: body.title, updatedAt: body.updatedAt } : item))
      );
    } else {
      setError(body.error ?? "Conversation could not be loaded.");
    }
    setLoadingConversation(false);
  }
```

Add `createConversation`:

```ts
  async function createConversation() {
    setLoadingConversation(true);
    setError("");
    const response = await fetch("/api/agent/conversations", { method: "POST" });
    const body = await response.json();
    if (response.ok) {
      const conversation = { id: body.id, title: body.title, updatedAt: body.updatedAt };
      setConversations((items) => [conversation, ...items.filter((item) => item.id !== conversation.id)]);
      setSelectedConversationId(body.id);
      setMessages(body.messages);
      setMessage("");
    } else {
      setError(body.error ?? "Conversation could not be created.");
    }
    setLoadingConversation(false);
  }
```

Update the `fetch("/api/agent"` body in `send`:

```ts
      body: JSON.stringify({ conversationId: selectedConversationId, message: content })
```

After a successful send, update conversation title/timestamp:

```ts
      if (body.conversation) {
        setConversations((items) =>
          [body.conversation, ...items.filter((item) => item.id !== body.conversation.id)]
        );
      }
```

- [ ] **Step 5: Render conversation rail**

Wrap the existing message panel with:

```tsx
    <section className="agent-workspace">
      <aside className="agent-conversation-rail" aria-label="Agent conversations">
        <button className="agent-new-chat" type="button" onClick={createConversation} disabled={loadingConversation}>
          New chat
        </button>
        <div className="agent-conversation-list">
          {conversations.map((conversation) => (
            <button
              type="button"
              key={conversation.id}
              className={conversation.id === selectedConversationId ? "agent-conversation-item active" : "agent-conversation-item"}
              aria-pressed={conversation.id === selectedConversationId}
              onClick={() => selectConversation(conversation.id)}
            >
              <span>{conversation.title}</span>
            </button>
          ))}
        </div>
      </aside>
      <section className="surface agent-panel">
        {error ? <div className="message message-error">{error}</div> : null}
        {/* existing messages, suggestions, and composer stay here */}
      </section>
    </section>
```

- [ ] **Step 6: Add responsive styles**

Append to `app/globals.css` near existing Agent styles:

```css
.agent-workspace {
  display: grid;
  grid-template-columns: minmax(190px, 240px) minmax(0, 1fr);
  gap: 16px;
  align-items: stretch;
}

.agent-conversation-rail {
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
  padding: 12px;
  min-height: 560px;
}

.agent-new-chat,
.agent-conversation-item {
  width: 100%;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--bg);
  color: var(--ink);
  text-align: left;
  padding: 10px 12px;
  cursor: pointer;
}

.agent-new-chat {
  margin-bottom: 12px;
  font-weight: 700;
}

.agent-conversation-list {
  display: grid;
  gap: 8px;
}

.agent-conversation-item span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.agent-conversation-item.active {
  border-color: var(--accent);
  background: var(--accent-soft);
}

@media (max-width: 760px) {
  .agent-workspace {
    grid-template-columns: 1fr;
  }

  .agent-conversation-rail {
    min-height: auto;
  }
}
```

- [ ] **Step 7: Run component tests**

Run: `npm test -- tests/components/AgentPanel.test.tsx`

Expected: PASS.

- [ ] **Step 8: Commit Agent UI**

```bash
git add 'app/(dashboard)/agent/page.tsx' components/AgentPanel.tsx app/globals.css tests/components/AgentPanel.test.tsx
git commit -m "feat: add agent conversation UI"
```

---

### Task 6: End-To-End Verification

**Files:**
- No planned source edits unless verification exposes a defect in a prior task.

- [ ] **Step 1: Run focused tests**

Run:

```bash
npm test -- tests/services/agentConversations.test.ts tests/services/agentContext.test.ts tests/services/agent.test.ts tests/api/agent.test.ts tests/components/AgentPanel.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run full tests**

Run: `npm test`

Expected: PASS, or only unrelated pre-existing failures with exact test names and failure messages recorded before stopping.

- [ ] **Step 3: Run production build**

Run: `npm run build`

Expected: PASS. A Next.js multiple-lockfiles or workspace-root warning is acceptable if the build completes.

- [ ] **Step 4: Apply migration locally**

Run: `npm run prisma:migrate -- --name agent_conversations`

Expected: PASS with the `20260621090000_agent_conversations` migration applied. If Prisma says the migration already exists, run `npx prisma migrate dev` and confirm the database is up to date.

- [ ] **Step 5: Verify `/agent` in the browser**

Use the running preview at `http://localhost:3001/agent`.

Expected browser checks:

- The Agent page loads without a runtime error.
- A conversation rail appears with a `New chat` button.
- Clicking `New chat` creates and selects a new empty conversation.
- Sending `我昨晚没睡好，今天还适合跑吗？` adds a user bubble and assistant bubble.
- Sending `同步一下最新恢复数据` returns an assistant response; if COROS Settings are incomplete, the response should mention the sync problem while still using existing local data.
- Switching back to an older conversation restores that conversation's messages.

- [ ] **Step 6: Final status**

Run: `git status --short`

Expected: only intentional files from this feature are modified or committed. Existing unrelated dirty files should still be present but not staged by feature commits.
