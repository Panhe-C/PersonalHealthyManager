# Agent 受限执行层 · 乔布斯式精简方案 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 Agent 从只读解释器升级为"受限执行者"，但用"事后撤销"取代"事前确认"：低/高风险一律直接执行 + 可一键撤销，唯一保留确认的是真实外部写回（本期仍 mock）。复用现有 `PlanAdjustment` 回滚基建，不新增 pending proposal 表。

**Architecture:** 在 Agent 服务与现有 service 之间加一层动作层（registry / proposals / safetyGuard / executor）。模型在回复里附带 `<actions>` 结构化提案 → 解析 → safetyGuard 硬墙校验 → executor 抓"前态快照"并经现有 service 执行 → 写一条 `undoable` 的 `PlanAdjustment(trigger="agent")`。前端在 assistant 气泡底部渲染"已执行 · 撤销"，撤销端点按快照回滚。按"可逆性"而非"风险"分级。

**Tech Stack:** Next.js App Router, React 19, TypeScript, Prisma 6 with SQLite, Vitest, Testing Library.

设计依据：`docs/superpowers/specs/2026-06-26-agent-action-layer-jobs-edition.md`。

---

## File Structure

- Modify `prisma/schema.prisma`：给 `PlanAdjustment` 加 `actionId / messageId / undoable / undoneAt`。
- Create `prisma/migrations/20260626093000_agent_action_undo/migration.sql`：4 条 `ALTER TABLE ADD COLUMN`。
- Create `src/services/agentActions/registry.ts`：动作注册表（id / 参数 schema / 可逆性 / executor 绑定）。
- Create `src/services/agentActions/proposals.ts`：解析模型 `<actions>` 块为结构化提案 + schema 校验。
- Create `src/services/agentActions/safetyGuard.ts`：安全硬墙（强度上调、reschedule 窗口校验）。
- Create `src/services/agentActions/snapshot.ts`：受影响行的快照序列化/还原（task + draft）。
- Create `src/services/agentActions/executor.ts`：抓快照 → 经现有 service 执行 → 写可逆 `PlanAdjustment`。
- Create `src/services/agentActions/undo.ts`：按快照回滚 + 失效/已打卡守卫。
- Create `src/services/mealMenuService.ts`：菜单当日缓存（`MealMenu` upsert）+ 缺失/过期拉 MCP。
- Modify `src/services/planService.ts`：`resolveMealMenusForPlan` 改调 `mealMenuService`。
- Modify `src/services/agentContext.ts`：`menu_advice` 注入实时/缓存菜单。
- Modify `src/services/agent.ts`：systemPrompt 加动作 id 清单与 `<actions>` 格式约束；回复体透出动作执行结果。
- Modify `app/api/agent/route.ts`：解析提案 → guard → executor → 把本次 `adjustments` 放进响应体与 `metadataJson`。
- Create `app/api/agent/adjustments/[id]/undo/route.ts`：撤销端点。
- Modify `components/AgentPanel.tsx`：`ChatMessage` 带 `adjustments`，气泡底部渲染"撤销"行 + 处理函数。
- Modify `app/globals.css`：撤销行样式。
- Add/update tests：`tests/services/agentActions/*.test.ts`、`tests/services/mealMenuService.test.ts`、`tests/api/agentActions.test.ts`、`tests/api/agentAdjustmentUndo.test.ts`、`tests/components/AgentPanel.test.tsx`、`tests/services/agent.test.ts`。

实施前运行 `git status --short`，把与本计划无关的脏文件排除在每次提交之外。本仓库当前有计划外的未提交改动（食堂菜单 MCP 等），仅在 Task 7 明确纳入。

---

### Task 1: 扩展 PlanAdjustment 以支持撤销

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260626093000_agent_action_undo/migration.sql`

- [ ] **Step 1: 更新 Prisma schema**

在 `prisma/schema.prisma` 的 `PlanAdjustment` 模型中，现有字段后追加四个字段：

```prisma
model PlanAdjustment {
  id                String    @id @default(cuid())
  planId            String
  userId            String
  trigger           String
  previousStateJson String
  newStateJson      String
  reason            String
  explanation       String
  actionId          String?
  messageId         String?
  undoable          Boolean   @default(false)
  undoneAt          DateTime?
  createdAt         DateTime  @default(now())

  plan Plan @relation(fields: [planId, userId], references: [id, userId], onDelete: Cascade)

  @@index([userId, createdAt])
}
```

- [ ] **Step 2: 创建迁移 SQL**

Create `prisma/migrations/20260626093000_agent_action_undo/migration.sql`：

```sql
ALTER TABLE "PlanAdjustment" ADD COLUMN "actionId" TEXT;
ALTER TABLE "PlanAdjustment" ADD COLUMN "messageId" TEXT;
ALTER TABLE "PlanAdjustment" ADD COLUMN "undoable" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PlanAdjustment" ADD COLUMN "undoneAt" DATETIME;
```

- [ ] **Step 3: 生成 Prisma client**

Run: `npm run prisma:generate`

Expected: PASS，`planAdjustment` 类型出现 `undoable / undoneAt / actionId / messageId`。

- [ ] **Step 4: 提交 schema 改动**

```bash
git add prisma/schema.prisma prisma/migrations/20260626093000_agent_action_undo/migration.sql
git commit -m "feat: add undo fields to plan adjustment"
```

---

### Task 2: 动作注册表与提案解析

**Files:**
- Create: `src/services/agentActions/registry.ts`
- Create: `src/services/agentActions/proposals.ts`
- Test: `tests/services/agentActions/proposals.test.ts`

- [ ] **Step 1: 写失败测试**

Create `tests/services/agentActions/proposals.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { parseActionProposals } from "@/src/services/agentActions/proposals";

describe("action proposal parsing", () => {
  it("extracts explanation and valid actions from an <actions> block", () => {
    const reply = [
      "<explanation>已为你把周三降为 easy</explanation>",
      "<actions>",
      '[{"id":"adjust_task_intensity","args":{"taskId":"t1","intensity":"easy"}}]',
      "</actions>"
    ].join("\n");

    const result = parseActionProposals(reply);

    expect(result.explanation).toBe("已为你把周三降为 easy");
    expect(result.actions).toEqual([
      { id: "adjust_task_intensity", args: { taskId: "t1", intensity: "easy" } }
    ]);
    expect(result.warnings).toEqual([]);
  });

  it("treats replies without an actions block as explanation-only", () => {
    const result = parseActionProposals("这是一段纯文字解释。");
    expect(result.actions).toEqual([]);
    expect(result.explanation).toBe("这是一段纯文字解释。");
  });

  it("drops unknown action ids and schema-invalid args with a warning", () => {
    const reply = [
      "<actions>",
      '[{"id":"delete_everything","args":{}},{"id":"adjust_task_intensity","args":{"taskId":"t1","intensity":"nuclear"}}]',
      "</actions>"
    ].join("\n");

    const result = parseActionProposals(reply);

    expect(result.actions).toEqual([]);
    expect(result.warnings.length).toBe(2);
  });

  it("recovers gracefully from malformed JSON in the actions block", () => {
    const result = parseActionProposals("<actions>\n[not json}\n</actions>");
    expect(result.actions).toEqual([]);
    expect(result.warnings.length).toBe(1);
  });
});
```

- [ ] **Step 2: 运行并确认失败**

Run: `npm test -- tests/services/agentActions/proposals.test.ts`

Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现注册表**

Create `src/services/agentActions/registry.ts`：

```ts
export type ActionReversibility = "readonly" | "reversible" | "external_irreversible";

export type AgentActionDefinition = {
  id: string;
  reversibility: ActionReversibility;
  validate: (args: unknown) => Record<string, unknown> | null;
};

const intensities = new Set(["recovery", "easy", "moderate"]);

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export const agentActionRegistry: Record<string, AgentActionDefinition> = {
  explain_plan: {
    id: "explain_plan",
    reversibility: "readonly",
    validate: () => ({})
  },
  recommend_menu: {
    id: "recommend_menu",
    reversibility: "readonly",
    validate: (raw) => {
      const args = (raw ?? {}) as Record<string, unknown>;
      return { date: str(args.date) ?? undefined, meal: str(args.meal) ?? undefined };
    }
  },
  adjust_task_intensity: {
    id: "adjust_task_intensity",
    reversibility: "reversible",
    validate: (raw) => {
      const args = (raw ?? {}) as Record<string, unknown>;
      const taskId = str(args.taskId);
      const intensity = str(args.intensity);
      if (!taskId || !intensity || !intensities.has(intensity)) return null;
      return { taskId, intensity };
    }
  },
  reschedule_task: {
    id: "reschedule_task",
    reversibility: "reversible",
    validate: (raw) => {
      const args = (raw ?? {}) as Record<string, unknown>;
      const taskId = str(args.taskId);
      const newStart = str(args.newStart);
      if (!taskId || !newStart) return null;
      return { taskId, newStart };
    }
  },
  skip_task: {
    id: "skip_task",
    reversibility: "reversible",
    validate: (raw) => {
      const args = (raw ?? {}) as Record<string, unknown>;
      const taskId = str(args.taskId);
      if (!taskId) return null;
      return { taskId, reason: str(args.reason) ?? "Skipped by agent" };
    }
  },
  regenerate_plan: {
    id: "regenerate_plan",
    reversibility: "reversible",
    validate: (raw) => {
      const args = (raw ?? {}) as Record<string, unknown>;
      const weekStart = str(args.weekStart);
      if (!weekStart) return null;
      return { weekStart };
    }
  },
  confirm_calendar_draft: {
    id: "confirm_calendar_draft",
    reversibility: "external_irreversible",
    validate: (raw) => {
      const args = (raw ?? {}) as Record<string, unknown>;
      const draftId = str(args.draftId);
      if (!draftId) return null;
      return { draftId };
    }
  }
};

export function actionIdList() {
  return Object.keys(agentActionRegistry);
}
```

- [ ] **Step 4: 实现提案解析**

Create `src/services/agentActions/proposals.ts`：

```ts
import { agentActionRegistry } from "@/src/services/agentActions/registry";

export type AgentActionProposal = { id: string; args: Record<string, unknown> };
export type ParsedAgentReply = {
  explanation: string;
  actions: AgentActionProposal[];
  warnings: string[];
};

function extractBlock(reply: string, tag: string): string | null {
  const match = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i").exec(reply);
  return match ? match[1].trim() : null;
}

export function parseActionProposals(reply: string): ParsedAgentReply {
  const explanationBlock = extractBlock(reply, "explanation");
  const actionsBlock = extractBlock(reply, "actions");
  const warnings: string[] = [];

  const explanation = explanationBlock ?? reply.replace(/<actions>[\s\S]*?<\/actions>/i, "").trim();

  if (!actionsBlock) return { explanation, actions: [], warnings };

  let raw: unknown;
  try {
    raw = JSON.parse(actionsBlock);
  } catch {
    warnings.push("actions block was not valid JSON");
    return { explanation, actions: [], warnings };
  }

  const items = Array.isArray(raw) ? raw : [];
  const actions: AgentActionProposal[] = [];

  for (const item of items) {
    const candidate = (item ?? {}) as { id?: unknown; args?: unknown };
    const id = typeof candidate.id === "string" ? candidate.id : "";
    const definition = agentActionRegistry[id];
    if (!definition) {
      warnings.push(`unknown action id: ${id || "(empty)"}`);
      continue;
    }
    const args = definition.validate(candidate.args);
    if (!args) {
      warnings.push(`invalid args for action: ${id}`);
      continue;
    }
    actions.push({ id, args });
  }

  return { explanation, actions, warnings };
}
```

- [ ] **Step 5: 运行测试**

Run: `npm test -- tests/services/agentActions/proposals.test.ts`

Expected: PASS.

- [ ] **Step 6: 提交**

```bash
git add src/services/agentActions/registry.ts src/services/agentActions/proposals.ts tests/services/agentActions/proposals.test.ts
git commit -m "feat: add agent action registry and proposal parsing"
```

---

### Task 3: 安全硬墙 safetyGuard

**Files:**
- Create: `src/services/agentActions/safetyGuard.ts`
- Test: `tests/services/agentActions/safetyGuard.test.ts`

- [ ] **Step 1: 写失败测试**

Create `tests/services/agentActions/safetyGuard.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { guardAction } from "@/src/services/agentActions/safetyGuard";

const freeWindows = [{ start: "2026-06-24T10:00:00+08:00", end: "2026-06-24T12:00:00+08:00" }];

describe("agent action safety guard", () => {
  it("blocks intensity upgrade when recovery is poor and downgrades to easy", () => {
    const result = guardAction(
      { id: "adjust_task_intensity", args: { taskId: "t1", intensity: "moderate" } },
      { poorRecovery: true, poorSleep: false, injury: false, freeWindows, taskCurrentIntensity: "easy" }
    );

    expect(result.accepted).toBe(true);
    expect(result.args.intensity).toBe("easy");
    expect(result.fallbackReason).toBeTruthy();
  });

  it("allows intensity changes when signals are healthy", () => {
    const result = guardAction(
      { id: "adjust_task_intensity", args: { taskId: "t1", intensity: "moderate" } },
      { poorRecovery: false, poorSleep: false, injury: false, freeWindows, taskCurrentIntensity: "easy" }
    );
    expect(result.accepted).toBe(true);
    expect(result.args.intensity).toBe("moderate");
  });

  it("rejects reschedule outside free windows", () => {
    const result = guardAction(
      { id: "reschedule_task", args: { taskId: "t1", newStart: "2026-06-24T23:00:00+08:00" } },
      { poorRecovery: false, poorSleep: false, injury: false, freeWindows, taskCurrentIntensity: "easy" }
    );
    expect(result.accepted).toBe(false);
    expect(result.fallbackReason).toContain("free window");
  });
});
```

- [ ] **Step 2: 运行并确认失败**

Run: `npm test -- tests/services/agentActions/safetyGuard.test.ts`

Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现 safetyGuard**

Create `src/services/agentActions/safetyGuard.ts`。要点：强度排序 `recovery<easy<moderate`，poorSleep/poorRecovery/injury 任一为真则禁止上调（降级到 `easy` 或维持更低值）；`reschedule_task` 的 `newStart` 必须落在某个 `freeWindow` 内，否则 `accepted:false`。其余动作默认通过。返回 `{ accepted, args, fallbackReason? }`。

```ts
import type { AgentActionProposal } from "@/src/services/agentActions/proposals";

export type GuardSignals = {
  poorSleep: boolean;
  poorRecovery: boolean;
  injury: boolean;
  freeWindows: Array<{ start: string; end: string }>;
  taskCurrentIntensity: string;
};

export type GuardResult = { accepted: boolean; args: Record<string, unknown>; fallbackReason?: string };

const order = ["recovery", "easy", "moderate"];

export function guardAction(action: AgentActionProposal, signals: GuardSignals): GuardResult {
  if (action.id === "adjust_task_intensity") {
    const requested = String(action.args.intensity);
    const blockUpgrade = signals.poorSleep || signals.poorRecovery || signals.injury;
    const isUpgrade = order.indexOf(requested) > order.indexOf(signals.taskCurrentIntensity);
    if (blockUpgrade && isUpgrade) {
      return {
        accepted: true,
        args: { ...action.args, intensity: "easy" },
        fallbackReason: "Recovery/sleep/injury signals block an intensity increase; kept at easy."
      };
    }
    return { accepted: true, args: action.args };
  }

  if (action.id === "reschedule_task") {
    const start = new Date(String(action.args.newStart)).getTime();
    const inWindow = signals.freeWindows.some(
      (window) => start >= new Date(window.start).getTime() && start < new Date(window.end).getTime()
    );
    if (!inWindow) {
      return { accepted: false, args: action.args, fallbackReason: "New start is not inside any calendar free window." };
    }
    return { accepted: true, args: action.args };
  }

  return { accepted: true, args: action.args };
}
```

- [ ] **Step 4: 运行测试**

Run: `npm test -- tests/services/agentActions/safetyGuard.test.ts`

Expected: PASS.

- [ ] **Step 5: 提交**

```bash
git add src/services/agentActions/safetyGuard.ts tests/services/agentActions/safetyGuard.test.ts
git commit -m "feat: add agent action safety guard"
```

---

### Task 4: 快照与执行器（含 skip 级联）

**Files:**
- Create: `src/services/agentActions/snapshot.ts`
- Create: `src/services/agentActions/executor.ts`
- Test: `tests/services/agentActions/snapshot.test.ts`

- [ ] **Step 1: 写失败测试（快照纯函数）**

Create `tests/services/agentActions/snapshot.test.ts`，覆盖序列化与从快照构造还原 update：

```ts
import { describe, expect, it } from "vitest";
import { serializeSnapshot, restoreStatementsFromSnapshot } from "@/src/services/agentActions/snapshot";

describe("agent action snapshot", () => {
  it("serializes touched tasks and drafts into a flat snapshot", () => {
    const snapshot = serializeSnapshot({
      tasks: [
        {
          id: "t1",
          intensity: "moderate",
          durationMinutes: 60,
          title: "Run",
          date: new Date("2026-06-24T00:00:00+08:00"),
          scheduledStart: new Date("2026-06-24T10:00:00+08:00"),
          scheduledEnd: new Date("2026-06-24T11:00:00+08:00"),
          status: "planned"
        }
      ],
      drafts: []
    });

    expect(snapshot.tasks[0]).toMatchObject({ id: "t1", intensity: "moderate", durationMinutes: 60, status: "planned" });
    expect(snapshot.drafts).toEqual([]);
  });

  it("builds per-row restore update payloads", () => {
    const statements = restoreStatementsFromSnapshot({
      tasks: [{ id: "t1", intensity: "easy", durationMinutes: 40, title: "Easy run", date: "2026-06-24", scheduledStart: null, scheduledEnd: null, status: "planned" }],
      drafts: [{ id: "d1", title: "Training: Easy run", startsAt: null, endsAt: null, notes: "n", status: "draft", failureReason: null }]
    });

    expect(statements.tasks[0]).toMatchObject({ id: "t1", data: { intensity: "easy", durationMinutes: 40, status: "planned" } });
    expect(statements.drafts[0]).toMatchObject({ id: "d1", data: { status: "draft" } });
  });
});
```

- [ ] **Step 2: 运行并确认失败**

Run: `npm test -- tests/services/agentActions/snapshot.test.ts`

Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现快照**

Create `src/services/agentActions/snapshot.ts`：定义 `ActionSnapshot = { tasks: TaskSnapshot[]; drafts: DraftSnapshot[]; planIds?: { superseded?: string; created?: string } }`。`serializeSnapshot` 把 Date 转 ISO 字符串；`restoreStatementsFromSnapshot` 把每行映射为 `{ id, data }`（task 还原 `intensity/durationMinutes/title/date/scheduledStart/scheduledEnd/status`；draft 还原 `title/startsAt/endsAt/notes/status/failureReason`），Date 字段从 ISO 解析回 `Date`。

- [ ] **Step 4: 实现执行器**

Create `src/services/agentActions/executor.ts`。结构：

```ts
import type { Prisma } from "@prisma/client";
import { prisma } from "@/src/db/client";
import { buildAdjustedTaskUpdate } from "@/src/services/checklistService";
import { generatePlanForUser } from "@/src/services/planService";
import { serializeSnapshot, type ActionSnapshot } from "@/src/services/agentActions/snapshot";
import type { AgentActionProposal } from "@/src/services/agentActions/proposals";

export type ExecutedAdjustment = { id: string; label: string; undoneAt: string | null };

// 1) 预演收集受影响行（skip/over/partial 走"宽收集"：目标任务 + 同 plan 内 date>目标 && status=planned 的全部 future task + 其 draft）
async function collectAffectedRows(tx: Prisma.TransactionClient, userId: string, action: AgentActionProposal): Promise<ActionSnapshot> { /* ... */ }

// 2) 真正变更：adjust/reschedule 用 buildAdjustedTaskUpdate；skip 标 skipped + 复用同款重排；regenerate 调 generatePlanForUser
async function applyAction(tx: Prisma.TransactionClient, userId: string, action: AgentActionProposal): Promise<{ label: string; reason: string; planId: string }> { /* ... */ }

export async function executeAgentAction(userId: string, action: AgentActionProposal, messageId: string): Promise<ExecutedAdjustment> {
  return prisma.$transaction(async (tx) => {
    const before = await collectAffectedRows(tx, userId, action);
    const applied = await applyAction(tx, userId, action);
    const after = await collectAffectedRows(tx, userId, action);

    const adjustment = await tx.planAdjustment.create({
      data: {
        planId: applied.planId,
        userId,
        trigger: "agent",
        actionId: action.id,
        messageId,
        undoable: true,
        previousStateJson: JSON.stringify(before),
        newStateJson: JSON.stringify(serializeSnapshot(after)),
        reason: applied.reason,
        explanation: applied.label
      }
    });

    return { id: adjustment.id, label: applied.label, undoneAt: null };
  });
}
```

实现注意：
- `adjust_task_intensity` / `reschedule_task` 复用导出的 `buildAdjustedTaskUpdate(task, changes)`（`checklistService` 第 99 行），同步更新关联 `calendarDraft`。
- `skip_task`：把目标任务 `status` 置 `skipped`，并对 `collectAffectedRows` 收集到的 future task 应用与 `completeTrainingTask` 一致的保守重排（下一个 future task 增量），快照需覆盖全部被触达行（见 spec §4.1）。
- `regenerate_plan`：在事务外先 `generatePlanForUser`（其内部已有事务与 supersede 逻辑），快照只记 `planIds`，executor 这里以"包装结果"为主；若难以纳入同一事务，则单独路径处理并仍写一条 `undoable` 调整（`planIds.superseded/created`）。
- 只读动作（`explain_plan`/`recommend_menu`）不进 executor。

- [ ] **Step 5: 运行测试**

Run: `npm test -- tests/services/agentActions/snapshot.test.ts`

Expected: PASS（executor 的集成行为在 Task 6 的 API 测试与手测覆盖；如需可加 executor 单测用 prisma 事务 mock）。

- [ ] **Step 6: 提交**

```bash
git add src/services/agentActions/snapshot.ts src/services/agentActions/executor.ts tests/services/agentActions/snapshot.test.ts
git commit -m "feat: add agent action executor with reversible snapshot"
```

---

### Task 5: 撤销服务与端点

**Files:**
- Create: `src/services/agentActions/undo.ts`
- Create: `app/api/agent/adjustments/[id]/undo/route.ts`
- Test: `tests/api/agentAdjustmentUndo.test.ts`

- [ ] **Step 1: 写失败测试**

Create `tests/api/agentAdjustmentUndo.test.ts`，mock prisma，覆盖：

```ts
// it: 404 当 adjustment 不属于用户或 trigger!="agent"
// it: 409 当 plan 已 superseded（"该调整已过期，无法撤销"）
// it: 409 当快照中某 task 已非 planned（"部分任务已开始，无法整体撤销"）
// it: 200 正常回滚——逐行写回 task/draft，标记 undoneAt
```

- [ ] **Step 2: 运行并确认失败**

Run: `npm test -- tests/api/agentAdjustmentUndo.test.ts`

Expected: FAIL，端点不存在。

- [ ] **Step 3: 实现撤销服务**

Create `src/services/agentActions/undo.ts`：

```ts
import { prisma } from "@/src/db/client";
import { restoreStatementsFromSnapshot, type ActionSnapshot } from "@/src/services/agentActions/snapshot";

export type UndoOutcome = { ok: true } | { ok: false; status: number; error: string };

export async function undoAgentAdjustment(userId: string, adjustmentId: string): Promise<UndoOutcome> {
  const adjustment = await prisma.planAdjustment.findFirst({
    where: { id: adjustmentId, userId, trigger: "agent" },
    include: { plan: { select: { status: true } } }
  });
  if (!adjustment || !adjustment.undoable) return { ok: false, status: 404, error: "Adjustment not found" };
  if (adjustment.undoneAt) return { ok: false, status: 409, error: "Adjustment already undone" };
  if (adjustment.plan.status === "superseded") return { ok: false, status: 409, error: "该调整已过期，无法撤销" };

  const snapshot = JSON.parse(adjustment.previousStateJson) as ActionSnapshot;
  const statements = restoreStatementsFromSnapshot(snapshot);

  return prisma.$transaction(async (tx) => {
    for (const task of statements.tasks) {
      const current = await tx.trainingTask.findFirst({ where: { id: task.id, userId }, include: { completion: true } });
      if (current && (current.completion || (current.status !== "planned" && current.status !== "skipped"))) {
        return { ok: false, status: 409, error: "部分任务已开始，无法整体撤销" } as UndoOutcome;
      }
    }
    for (const task of statements.tasks) {
      await tx.trainingTask.update({ where: { id: task.id }, data: task.data });
    }
    for (const draft of statements.drafts) {
      await tx.calendarEventDraft.updateMany({ where: { id: draft.id, userId }, data: draft.data });
    }
    // regenerate 的反向 supersede：若 snapshot.planIds 存在，新计划标 superseded、旧计划恢复 active
    await tx.planAdjustment.update({ where: { id: adjustmentId }, data: { undoneAt: new Date() } });
    return { ok: true } as UndoOutcome;
  });
}
```

- [ ] **Step 4: 实现端点**

Create `app/api/agent/adjustments/[id]/undo/route.ts`：

```ts
import { NextResponse } from "next/server";
import { withUser } from "@/src/auth/api";
import { undoAgentAdjustment } from "@/src/services/agentActions/undo";

export const POST = withUser(async (user, _request: Request, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  const outcome = await undoAgentAdjustment(user.id, id);
  if (!outcome.ok) return NextResponse.json({ error: outcome.error }, { status: outcome.status });
  return NextResponse.json({ id, undoneAt: new Date().toISOString() });
});
```

- [ ] **Step 5: 运行测试**

Run: `npm test -- tests/api/agentAdjustmentUndo.test.ts`

Expected: PASS.

- [ ] **Step 6: 提交**

```bash
git add src/services/agentActions/undo.ts 'app/api/agent/adjustments/[id]/undo/route.ts' tests/api/agentAdjustmentUndo.test.ts
git commit -m "feat: add agent adjustment undo endpoint"
```

---

### Task 6: 把动作层接入 /api/agent 与模型约束

**Files:**
- Modify: `src/services/agent.ts`
- Modify: `app/api/agent/route.ts`
- Test: `tests/services/agent.test.ts`
- Test: `tests/api/agentActions.test.ts`

- [ ] **Step 1: 写失败测试（prompt 约束 + 端点执行）**

在 `tests/services/agent.test.ts` 增加：模型 systemPrompt 含动作 id 清单与 `<actions>` 格式要求。

Create `tests/api/agentActions.test.ts`：mock `createAgentResponseForUser` 返回带 `<actions>` 的回复，断言 `/api/agent` 响应体含 `adjustments`，且 `executeAgentAction` 被以解析出的动作调用；mock guard 拒绝时断言文字含 fallback 且不执行。

- [ ] **Step 2: 运行并确认失败**

Run: `npm test -- tests/services/agent.test.ts tests/api/agentActions.test.ts`

Expected: FAIL。

- [ ] **Step 3: 给 systemPrompt 加动作约束**

In `src/services/agent.ts` `systemPrompt`，追加（用 `actionIdList()`）：

```ts
    `You may propose actions only from this list: ${actionIdList().join(", ")}.`,
    "Do not invent action ids or arguments.",
    "Put any actions in a single <actions> JSON array block; put user-facing text in <explanation>.",
    "All listed actions execute immediately and are undoable by the user; never claim an irreversible external write unless the app reports it.",
    "If a safety rule overrides your proposal, tell the user truthfully what was changed and why."
```

- [ ] **Step 4: 在 `/api/agent` 解析 → guard → 执行**

In `app/api/agent/route.ts`，拿到 `response.message` 后：

```ts
const parsed = parseActionProposals(response.message);
const executed: ExecutedAdjustment[] = [];
const notes: string[] = [];
// 先写消息拿到 assistant messageId（createMany 改为 create 两条，或先建 assistant message）
for (const action of parsed.actions) {
  const def = agentActionRegistry[action.id];
  if (def.reversibility === "readonly") continue; // recommend_menu/explain 在上下文阶段处理
  const signals = await loadGuardSignals(user.id, action); // 取 task 当前强度 + poorSleep/recovery/injury + freeWindows
  const guarded = guardAction(action, signals);
  if (!guarded.accepted) { notes.push(`已尝试 ${action.id} 但被安全规则拦下：${guarded.fallbackReason}`); continue; }
  const adjustment = await executeAgentAction(user.id, { ...action, args: guarded.args }, assistantMessageId);
  executed.push(adjustment);
  if (guarded.fallbackReason) notes.push(guarded.fallbackReason);
}
```

把 `executed` 放进响应体 `adjustments`，把 `notes` 拼到回复文字末尾；assistant `metadataJson` 增加 `actions: parsed.actions.map(a => a.id)`、`adjustmentIds: executed.map(a => a.id)`、`warnings: parsed.warnings`。响应文字用 `parsed.explanation`（无 explanation 块时退回原 `response.message`）。

- [ ] **Step 5: 运行测试**

Run: `npm test -- tests/services/agent.test.ts tests/api/agentActions.test.ts tests/api/agent.test.ts`

Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add src/services/agent.ts app/api/agent/route.ts tests/services/agent.test.ts tests/api/agentActions.test.ts
git commit -m "feat: execute reversible agent actions from chat"
```

---

### Task 7: 食堂菜单服务与 recommend_menu 联动

**Files:**
- Create: `src/services/mealMenuService.ts`
- Modify: `src/services/planService.ts`
- Modify: `src/services/agentContext.ts`
- Test: `tests/services/mealMenuService.test.ts`

> 本任务纳入当前未提交的 `src/providers/meal-menu-mcp.ts` 与既有 `tests/providers/meal-menu-mcp.test.ts`、`tests/services/planServiceMealMenu.test.ts`。

- [ ] **Step 1: 写失败测试**

Create `tests/services/mealMenuService.test.ts`，mock prisma `mealMenu` 与 `fetchMealMenusFromStdioMcp`、`loadDataMcpConnection`，覆盖：当日已有缓存 → 不 spawn MCP；缺失/过期 → 拉 MCP 并 `upsert`；MCP 失败 → 回退 mock 且标记 `{ source: "mock" }`。

- [ ] **Step 2: 运行并确认失败**

Run: `npm test -- tests/services/mealMenuService.test.ts`

Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现 mealMenuService**

Create `src/services/mealMenuService.ts`：`getMealMenusForDate(userId, date)` —— 先查 `MealMenu`（同 `userId` + 当日 `date`）；命中即反序列化 `itemsJson` 返回；否则按 `loadDataMcpConnection(userId, "meal_menu")` 拉 stdio MCP，成功则按 `(userId,date,meal)` upsert 后返回，失败回退 `getMockMealMenu`。当日缓存即 TTL（跨天 `date` 不同自然失效）。

- [ ] **Step 4: 接入计划生成与 Agent 上下文**

- `src/services/planService.ts`：`resolveMealMenusForPlan` 改为遍历该周日期调 `mealMenuService.getMealMenusForDate`（或保留周级取数但走缓存）；保持现有返回结构不破坏 `planServiceMealMenu.test.ts`。
- `src/services/agentContext.ts`：`loadMenuContext` 增补当日实时/缓存菜单注入（具体菜品名 + 蛋白质），供 `menu_advice` 意图。

- [ ] **Step 5: 运行测试**

Run: `npm test -- tests/services/mealMenuService.test.ts tests/services/planServiceMealMenu.test.ts tests/providers/meal-menu-mcp.test.ts tests/services/agentContext.test.ts`

Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add src/services/mealMenuService.ts src/services/planService.ts src/services/agentContext.ts src/providers/meal-menu-mcp.ts tests/services/mealMenuService.test.ts tests/providers/meal-menu-mcp.test.ts tests/services/planServiceMealMenu.test.ts
git commit -m "feat: add meal menu cache service and agent menu context"
```

---

### Task 8: AgentPanel 撤销行

**Files:**
- Modify: `components/AgentPanel.tsx`
- Modify: `app/globals.css`
- Test: `tests/components/AgentPanel.test.tsx`

- [ ] **Step 1: 写失败测试**

在 `tests/components/AgentPanel.test.tsx` 增加：

```ts
it("renders an undo affordance for executed adjustments and undoes on click", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe("/api/agent/adjustments/adj-1/undo");
      return { ok: true, json: async () => ({ id: "adj-1", undoneAt: "2026-06-26T14:00:00.000Z" }) };
    })
  );

  render(
    <AgentPanel
      initialConversations={[{ id: "c1", title: "T", updatedAt: "2026-06-26T13:00:00.000Z" }]}
      initialConversationId="c1"
      initialMessages={[
        { id: "m1", role: "assistant", content: "已把周三降为 easy", adjustments: [{ id: "adj-1", label: "已把周三降为 easy", undoneAt: null }] }
      ]}
    />
  );

  fireEvent.click(screen.getByRole("button", { name: "撤销" }));
  await waitFor(() => expect(screen.getByText("已撤销")).toBeInTheDocument());
  vi.unstubAllGlobals();
});
```

并在已有的"发送"测试里断言：当 `/api/agent` 返回体含 `adjustments` 时，assistant 气泡下出现"撤销"按钮。

- [ ] **Step 2: 运行并确认失败**

Run: `npm test -- tests/components/AgentPanel.test.tsx`

Expected: FAIL。

- [ ] **Step 3: 扩展 ChatMessage 与渲染**

In `components/AgentPanel.tsx`：

```ts
type AdjustmentRef = { id: string; label: string; undoneAt: string | null };
type ChatMessage = { id: string; role: string; content: string; adjustments?: AdjustmentRef[] };
```

`send()` 成功后把 `body.adjustments` 挂到新 assistant 消息上。新增 `undoAdjustment(messageId, adjustmentId)`：`POST /api/agent/adjustments/{id}/undo` → 成功则把该 adjustment 的 `undoneAt` 置为返回值（乐观），并调用 `router.refresh()`（从 `next/navigation` 引入 `useRouter`）。在 assistant 气泡 `RichMessageContent` 之后渲染：

```tsx
{item.role === "assistant" && item.adjustments?.length
  ? item.adjustments.map((adjustment) => (
      <div className="agent-adjustment-row" key={adjustment.id}>
        <span>{adjustment.label}</span>
        {adjustment.undoneAt ? (
          <span className="agent-adjustment-undone">已撤销</span>
        ) : (
          <button type="button" className="agent-undo-button" onClick={() => undoAdjustment(item.id, adjustment.id)}>
            撤销
          </button>
        )}
      </div>
    ))
  : null}
```

- [ ] **Step 4: 加样式**

Append to `app/globals.css`：`.agent-adjustment-row`（flex、间距、小字号、顶部细分隔线）、`.agent-undo-button`（文字按钮样式，含 `aria` 友好的 hover/focus）、`.agent-adjustment-undone`（弱化色）。

- [ ] **Step 5: 运行测试**

Run: `npm test -- tests/components/AgentPanel.test.tsx`

Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add components/AgentPanel.tsx app/globals.css tests/components/AgentPanel.test.tsx
git commit -m "feat: add agent action undo affordance"
```

---

### Task 9: 端到端验证

**Files:**
- 无计划内源改动，除非验证暴露前序任务缺陷。

- [ ] **Step 1: 聚焦测试**

```bash
npm test -- tests/services/agentActions/proposals.test.ts tests/services/agentActions/safetyGuard.test.ts tests/services/agentActions/snapshot.test.ts tests/api/agentActions.test.ts tests/api/agentAdjustmentUndo.test.ts tests/services/mealMenuService.test.ts tests/components/AgentPanel.test.tsx
```

Expected: PASS。

- [ ] **Step 2: 全量测试**

Run: `npm test`

Expected: PASS，或仅有与本计划无关的既有失败（记录确切用例名与信息后再停）。

- [ ] **Step 3: 生产构建**

Run: `npm run build`

Expected: PASS。

- [ ] **Step 4: 本地应用迁移**

Run: `npm run prisma:migrate -- --name agent_action_undo`

Expected: PASS，`20260626093000_agent_action_undo` 已应用。

- [ ] **Step 5: 浏览器验证 `/agent`**

预期手测：
- 发送"我昨晚没睡好，把周三训练降到 easy"——assistant 气泡下出现一行"已把周三降为 easy · 撤销"，Plan 页周三强度变为 easy。
- 点"撤销"——该行变"已撤销"，Plan 页恢复原强度。
- 发送会被安全规则拦下的强度上调（恢复差时升 moderate）——回复如实说明"被安全规则拦下，已改为 easy"。
- 发送菜单类问题——回复含当日具体菜品建议（MCP 配好时为实时，否则 mock 且说明）。
- 真实日历写回仍走 Plan 页草稿确认，不在 Agent 内直接发生。

- [ ] **Step 6: 最终状态**

Run: `git status --short`

Expected: 仅本特性的预期文件被提交；计划外脏文件保持未暂存。

---

## 范围与非目标

**范围内**：动作层（registry/proposals/safetyGuard/snapshot/executor/undo）、按可逆性分级的 7 个动作、`PlanAdjustment` 撤销扩展、撤销端点、AgentPanel 撤销行、食堂菜单缓存与联动。

**非目标**：飞书日历真实写回（保持 mock）、pending proposal 确认机制（本版删除）、创建/删除任务与改目标类动作、原生 tool-use 集成、规则引擎或打卡重排重写。
