# Healthy Body Manager

Healthy Body Manager is a personal training, recovery, schedule, and nutrition planning prototype. It combines a Next.js Web App with a rule-based planning engine and a conversational Agent shell.

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

Generating the same week again supersedes the previous active plan and its unconfirmed calendar drafts, so only the latest proposal remains actionable.

## Development

```bash
npm install
cp .env.example .env
npm run prisma:generate
npx prisma migrate deploy
npm run seed
npm run dev
```

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
