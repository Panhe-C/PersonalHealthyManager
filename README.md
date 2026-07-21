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

Calendar write-back is confirmation-first. Confirming a draft invokes the locally authenticated `lark-cli` user identity to create, update, or delete the corresponding Feishu event. Failed writes retain their error and can be retried; the app never records a mock event ID.

Generating the same week again supersedes the previous active plan and its calendar drafts, so only the latest proposal remains actionable. Existing external event IDs are carried into replacement drafts to avoid duplicate calendar events, while events that no longer fit the plan become cancellation drafts.
When checklist feedback changes a future scheduled task, its calendar draft is updated too. Previously confirmed events return to draft status with the same external event ID so the change requires confirmation.

## Development

```bash
npm install
cp .env.example .env
npm run prisma:generate
npx prisma migrate deploy
HBM_OWNER_EMAIL=you@example.com \
HBM_OWNER_PASSWORD='use-a-strong-password' \
npm run owner:setup
npm run dev
```

`npm run dev` starts the Next.js dev server with built-in Fast Refresh, which hot-reloads changes under `app/`, `src/`, and `components/` (including route handlers and server modules) without a manual restart.

Open the local URL printed by Next.js and log in with the owner credentials you supplied above. `npm run owner:setup` is idempotent: rerunning it updates the owner's password and timezone. Set `HBM_OWNER_TIMEZONE` when a timezone other than `Asia/Shanghai` is needed.

`npm run seed` remains available only for local development fixtures. It must not be used to provision a real personal account.

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

## Single-node production deployment

The production container keeps SQLite under a named `/data` volume, applies committed Prisma migrations before every start, runs as an unprivileged user, and exposes `/api/health` as its container health check. This is intended for the current single-user, single-instance deployment; do not run multiple replicas against the same SQLite file.

Generate and store a stable 32-byte settings encryption key in the deployment environment, then build and start the service behind an HTTPS reverse proxy:

```bash
export SETTINGS_ENCRYPTION_KEY="$(openssl rand -base64 32)"
docker compose -f compose.production.yml up -d --build
docker compose -f compose.production.yml ps
```

The published port binds to localhost by default (`127.0.0.1:3000`). Configure the reverse proxy to forward to it, or set `HBM_PORT` when another local port is needed. Keep the generated encryption key stable: changing it makes saved provider credentials unreadable.

Create the real owner account once inside the running container. Supply the password only for that command instead of storing it in the Compose file:

```bash
docker compose -f compose.production.yml --profile tools run --rm \
  -e HBM_OWNER_EMAIL="you@example.com" \
  -e HBM_OWNER_PASSWORD="replace-with-a-strong-password" \
  owner-setup
```

The one-shot setup image shares only the persistent database volume with the app and exits after provisioning. The minimal runtime image does not include development tools or the setup script. Never run `npm run seed` in production.

Create an online SQLite snapshot inside the persistent volume:

```bash
docker compose -f compose.production.yml exec app \
  node scripts/data-backup.mjs /data/backups
```

Copy `/data/backups` to separate storage on a schedule. A named Docker volume is persistence, not an independent backup.

## Backup and recovery

Create a consistent SQLite snapshot while the app is running:

```bash
npm run data:backup
```

Backups and their SHA-256 manifests are written to the ignored `backups/` directory. To restore one, stop the Web server first and pass the explicit confirmation flag:

```bash
npm run data:restore -- --from backups/<snapshot>.sqlite --confirm
```

Restore validates the SQLite header and manifest, then keeps the current database in `backups/pre-restore-*` before replacing it.

## Privacy and release

- [Privacy notice](docs/privacy-policy.md)
- [Data export and account deletion](docs/data-deletion.md)
- [Release checklist](docs/release-checklist.md)
