# Healthy Body Manager

Healthy Body Manager is a personal training, recovery, schedule, and nutrition planning prototype. It combines a Next.js Web App with a rule-based planning engine and a conversational Agent shell.

## 产品简介

**一句话定位**：用规则引擎保证训练安全底线，用 AI Agent 提供自然语言交互，把"今天该练什么、能不能练、什么时间练、怎么吃"一次性回答清楚。

**面向谁**：有可穿戴设备（COROS 等）的耐力运动爱好者 + 用飞书日历管理时间的白领 + 有短期赛事目标需要倒推备战 + 受过伤需要保守递进的人。

**核心闭环**：可穿戴数据/日历同步 → 规则引擎产出保守周计划 → 打卡自适应重排剩余计划 → 营养目标与菜单建议 → 日历草稿确认写入 → AI Agent 对话复盘与调整。

**关键设计**：
- **安全门控**：睡眠 <6h、恢复 <50%、有伤病，任一命中即自动降级为 recovery 强度
- **确认优先**：日历写入需用户显式确认，外部事件 ID 复用避免重复建会
- **可撤销 Agent**：动作分 readonly / reversible / external_irreversible 三级，reversible 动作全量留快照可回滚
- **数据源解耦**：外部字段在 `src/providers` 内规范化，规划引擎只吃内部模型
- **双端**：Next.js Web + Expo iOS（M1 骨架已就位，5 Tab：今日/计划/数据/教练/我的）

完整产品说明见 [docs/product-overview.md](./docs/product-overview.md)。

## First Version

- Email/password login with user-scoped data.
- Body profile and active goal management.
- COROS-style activity, sleep, and recovery import APIs.
- Feishu Calendar-style schedule import APIs.
- Conservative weekly training generation from goals, recovery, sleep, injuries, and calendar availability.
- Daily training checklists that update training history and conservatively adjust the remaining weekly plan.
- Mock daily menu recommendations and nutrition guidance.
- Calendar event drafts that require explicit user confirmation.
- Persisted Agent conversations for recovery, replanning, menu, and calendar workflows.

## Architecture

```text
External Agent / MCP workflows
  -> COROS and Feishu payloads
  -> /api/sync/coros and /api/sync/calendar
  -> provider normalizers
  -> user-scoped Prisma records
  -> deterministic planning engine
  -> plans, checklist items, nutrition targets, and calendar drafts
  -> Web App and Agent explanations
```

The planning engine only consumes internal normalized models. Raw provider field names stay inside `src/providers`.

## MCP Integration

The first version exposes import endpoints that an external Agent or MCP workflow can call after reading COROS and Feishu data:

- `POST /api/sync/coros`
- `POST /api/sync/calendar`

The Web App includes a `Sync demo data` command that exercises those same endpoints with local sample payloads.

Calendar write-back is confirmation-first. Confirming a draft currently records a mock Feishu external event ID. A real Feishu MCP write can replace that provider boundary without changing the plan or UI workflow.

Generating the same week again supersedes the previous active plan and its calendar drafts, so only the latest proposal remains actionable. Existing external event IDs are carried into replacement drafts to avoid duplicate calendar events, while events that no longer fit the plan become cancellation drafts.
When checklist feedback changes a future scheduled task, its calendar draft is updated too. Previously confirmed events return to draft status with the same external event ID so the change requires confirmation.

## Development

```bash
npm install
cp .env.example .env
npm run prisma:generate
npx prisma migrate deploy
npm run seed
npm run dev
```

`npm run dev` starts the Next.js dev server with built-in Fast Refresh, which hot-reloads changes under `app/`, `src/`, and `components/` (including route handlers and server modules) without a manual restart.

Open the local URL printed by Next.js and log in with:

- Email: `demo@example.com`
- Password: `healthy-body-demo`

Then:

1. Open `Profile`, save a body profile, and sync demo data.
2. Open `Goals` and add a primary or short-term event goal.
3. Open `Plan` and generate the current week.
4. Complete or skip checklist items, optionally link a COROS activity, then select `Update training` to adjust the remaining weekly plan.
5. Confirm calendar drafts only after reviewing them.
6. Use `Agent` for recovery, calendar, menu, and replanning prompts.

## Verification

```bash
npm test
npm run build
```

The project uses SQLite for local development. Local `.env` and database files are ignored by Git.
