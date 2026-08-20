# Healthy Body Manager

Healthy Body Manager is a personal training, recovery, schedule, and nutrition planning prototype. It combines a Next.js Web App with a rule-based planning engine and a conversational Agent shell.

## First Version

- Direct self-service registration, email/password login, password reset, and user-scoped data.
- First-run onboarding that walks through body profile, goal, schedule, and plan generation in dependency order, with a standing health disclaimer.
- Structured JSON logging with redaction, optional error webhook, and request IDs on authenticated routes.
- Automated SQLite backups with retention, optional offsite copy, LaunchAgent scheduler, and recovery drills.
- Body profile and active goal management.
- COROS-style activity, sleep, and recovery import APIs.
- Feishu Calendar-style schedule import APIs.
- Conservative weekly training generation from goals, recovery, sleep, injuries, and calendar availability.
- Daily training checklists that update training history and conservatively adjust the remaining weekly plan.
- Nutrition guidance derived from the goal and the training intensity, plus per-dish recommendations when a meal menu connection is configured.
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

That identity belongs to whoever deployed the server, and the target calendar comes from a single `HBM_LARK_CALENDAR_ID`, so a confirmation from any other account would create the event on the deployer's calendar. Write-back therefore serves exactly one account: set `HBM_LARK_CALENDAR_ACCOUNT_EMAIL` to it. An unset value disables write-back instead of writing to the wrong calendar. Moving this to per-user OAuth is tracked in the [production readiness plan](docs/production-readiness-plan.md).

Generating the same week again supersedes the previous active plan and its calendar drafts, so only the latest proposal remains actionable. Existing external event IDs are carried into replacement drafts to avoid duplicate calendar events, while events that no longer fit the plan become cancellation drafts.
When checklist feedback changes a future scheduled task, its calendar draft is updated too. Previously confirmed events return to draft status with the same external event ID so the change requires confirmation.

## Accounts and registration

Self-service registration is available in development by default and is controlled by `HBM_REGISTRATION_ENABLED`. When enabled, `/register` creates an immediately usable account and both Web and iOS sign in with the submitted credentials. When disabled, the Web and configured mobile clients hide the registration entry, `/register` explains that the deployment is invitation-only, and the registration API returns `403 registration_disabled`. Existing owner login remains available.

Registration responses are deliberately identical whether or not the address already has an account, so the endpoint cannot be used to discover which emails are registered. An existing usable account is not changed; the follow-up login still requires its correct password. Registration is rate limited per IP and per address.

A forgotten password is recovered from `/forgot-password`, which emails a single-use link valid for one hour. Setting the new password signs every existing device out, since a reset is what someone does when they believe the account is compromised. This endpoint answers identically for unknown addresses too.

`npm run owner:setup` still works and remains the way to provision or reset the deployment owner account.

| Endpoint | Purpose |
| --- | --- |
| `POST /api/v1/auth/register` | Create an immediately usable account |
| `POST /api/v1/auth/forgot-password` | Email a password reset link |
| `POST /api/v1/auth/reset-password` | Exchange a reset token for a new password |

### Email delivery

Direct registration does not require email delivery. `HBM_EMAIL_TRANSPORT=console` (the local default) prints password-recovery messages to the server log; those messages are not delivered. For working password recovery, select `smtp` and configure `HBM_SMTP_HOST`, `HBM_EMAIL_FROM`, `HBM_SMTP_USER`, and `HBM_SMTP_PASSWORD`; `npm run release:web` validates the complete SMTP policy whenever that transport is selected. `HBM_SMTP_PORT` defaults to `587`, and port `465` implies TLS.

## Model configuration

The coach runs on the user's own provider account: every account brings its own API key, and there is no hosted key. Without one the rest of the app still works, but the coach does not.

Choosing a provider is the whole configuration; the model name and base URL come from the provider table in `src/settings/defaults.ts` and are never accepted from the client. The only field either client asks for is the API key, which is stored encrypted.

A newly entered key is checked against the provider before it is stored. A `401` or `403` fails the save with the provider's own explanation, so a key issued by the wrong platform is caught on the field the user just filled in. Any other failure still saves: a provider that cannot be reached at that moment is not evidence that the key is wrong.

Because the identity is derived on read rather than copied into the row, bumping a provider's `defaultModel` moves every existing account onto the newer model on their next request, with no migration. Both clients keep a mirror of the table purely to preview the model when the user taps a different provider; the server's answer always wins after a save.

| Provider | Model | Base URL |
| --- | --- | --- |
| OpenAI | `gpt-5.6-terra` | `https://api.openai.com/v1` |
| Anthropic | `claude-opus-5` | `https://api.anthropic.com/v1` |
| DeepSeek | `deepseek-v4-flash` | `https://api.deepseek.com` |
| MiniMax | `MiniMax-M3` | `https://api.minimax.io/v1` |
| Kimi / Moonshot | `kimi-k3` | `https://api.moonshot.ai/v1` |
| GLM / Zhipu | `glm-5.2` | `https://open.bigmodel.cn/api/paas/v4` |

`Custom` is the exception and the escape hatch for relays and self-hosted gateways: it is the one provider that asks for a model name and base URL, and it rejects a save that omits either.

Every provider in that table has a neighbouring product whose keys look identical but are issued by a separate account system, and the resulting `401` is indistinguishable from an expired key. Each entry therefore carries a `credentialSource` string naming the platform that issues a working key. Both clients show it next to the API key field before the user pastes anything, and the chat path and `Test model` append it to any 401 or 403. Kimi is the sharpest case: a `sk-kim` key from the Kimi Code coding membership (`api.kimi.com/coding/v1`) is rejected by the Open Platform endpoint this provider targets. Point `Custom` at the coding endpoint with model `kimi-for-coding` to use one of those keys.

### Meal menus

Menus are only ever imported. An account with no meal menu connection has no menu section at all: the Today tab, the plan page, and the coach context omit it rather than substituting sample dishes. The nutrition targets and the carbohydrate guidance come from the goal and the training intensity, so they are shown either way; only the per-dish recommendations depend on an imported menu.

A configured connection that fails is reported rather than silently treated as empty, so a broken session or canteen name is visible instead of looking like "no menu today".

The stdio command and its arguments are fixed by the server and ignored if a client submits them. They are handed to `spawn`, so accepting them from a client would let any account run an arbitrary program on the server. The per-account part of the connection is the Feishu session and the canteen name. The child process also receives an explicit environment allowlist rather than the server's own, keeping `SESSION_SECRET`, `SETTINGS_ENCRYPTION_KEY`, and `DATABASE_URL` out of it.

### COROS authorization from the iOS app

COROS authenticates over OAuth, which has to run in a real browser. The app uses its authenticated API request to let the server prepare OAuth state, PKCE, and the callback before opening the provider:

1. The app pins the COROS region via `POST /api/v1/settings/mcp/coros/prep`.
2. `POST /api/v1/settings/mcp/oauth/authorize?connection=coros` prepares the pending authorization and returns the final COROS authorize URL.
3. The app opens COROS directly in the system authentication browser; the HBM domain is used only as the registered OAuth callback.
4. The callback redirects to `HBM_APP_OAUTH_RETURN_URL` (default `hbm://mcp-oauth`) so the in-app browser dismisses itself and the app refreshes its settings.

The authorization code is single-use and is exchanged immediately by the callback; it is not persisted. Only the resulting access and refresh tokens are stored, encrypted with `SETTINGS_ENCRYPTION_KEY`. Set `HBM_APP_OAUTH_RETURN_URL` if the app ships under a scheme other than `hbm`.

## Development

```bash
npm install
cp .env.example .env
npm run prisma:generate
npx prisma migrate deploy
npm run dev
```

Open the local URL printed by Next.js and register at `/register`. Alternatively, provision the owner account directly:

```bash
HBM_OWNER_EMAIL=you@example.com \
HBM_OWNER_PASSWORD='use-a-strong-password' \
npm run owner:setup
```

`npm run dev` starts the Next.js dev server with built-in Fast Refresh, which hot-reloads changes under `app/`, `src/`, and `components/` (including route handlers and server modules) without a manual restart.

`npm run owner:setup` is idempotent: rerunning it updates the owner's password and timezone. Set `HBM_OWNER_TIMEZONE` when a timezone other than `Asia/Shanghai` is needed.

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

The production container keeps SQLite under `/data`, bind-mounted from `${HBM_DATA_HOST_DIR:-/srv/healthy-body-manager/data}` on the host, applies committed Prisma migrations before every start, runs as an unprivileged user, and exposes `/api/health` as its container health check. Data is scoped per user, but the deployment is still single-instance: do not run multiple replicas against the same SQLite file. SQLite also bounds how many concurrent accounts this setup can serve, so an installation that opens registration to a wide audience should move to Postgres first.

The production origin is uniquely `https://www.cbhdev.xyz`. Generate and store stable session/settings secrets, fill the real legal metadata, deliberately choose whether registration is open, then build and start the service behind Caddy:

```bash
export SETTINGS_ENCRYPTION_KEY="$(openssl rand -base64 32)"
export HBM_APP_BASE_URL="https://www.cbhdev.xyz"
export HBM_PUBLIC_BASE_URL="https://www.cbhdev.xyz"
export HBM_REGISTRATION_ENABLED="false"
npm run release:web
docker compose --env-file .env -f compose.production.yml up -d --build
docker compose --env-file .env -f compose.production.yml ps
```

Do not use placeholder values for `HBM_OPERATOR_NAME`, `HBM_PRIVACY_EMAIL`, `HBM_POLICY_EFFECTIVE_DATE`, or `HBM_DEPLOYMENT_REGION`; the deployer must supply and legally review them. To open registration, set `HBM_REGISTRATION_ENABLED=true`, rerun `npm run release:web`, and set `EXPO_PUBLIC_REGISTRATION_ENABLED=true` for the matching mobile build. SMTP remains optional unless working password recovery is required.

The published port binds to localhost by default (`127.0.0.1:3000`); never expose port 3000 through the cloud firewall. Install `deploy/Caddyfile`, which serves the canonical `www` HTTPS origin and redirects the apex domain. The application server firewall should expose only SSH/HTTP/HTTPS (`22`, `80`, `443`). Complete any required ICP filing before public mainland-China service. Keep the generated encryption key stable: changing it makes saved provider credentials unreadable. See [production deployment](docs/production-deployment.md) for the full runbook.

Create the real owner account once inside the running container. Supply the password only for that command instead of storing it in the Compose file:

```bash
docker compose -f compose.production.yml --profile tools run --rm \
  -e HBM_OWNER_EMAIL="you@example.com" \
  -e HBM_OWNER_PASSWORD="replace-with-a-strong-password" \
  owner-setup
```

The one-shot setup image shares only the persistent database volume with the app and exits after provisioning. The minimal runtime image does not include development tools or the setup script. Never run `npm run seed` in production.

Create an online SQLite snapshot with the maintenance-only backup service. First create a host directory writable by container UID/GID `1001:1001`, then set `HBM_BACKUP_HOST_DIR` (and optionally `HBM_BACKUP_RETENTION_DAYS`) in `.env`:

```bash
sudo mkdir -p /srv/healthy-body-manager/backups
sudo mkdir -p /srv/healthy-body-manager/data
sudo chown 1001:1001 /srv/healthy-body-manager/data /srv/healthy-body-manager/backups
sudo chmod 700 /srv/healthy-body-manager/data /srv/healthy-body-manager/backups
docker compose --env-file .env -f compose.production.yml --profile maintenance run --rm backup
```

The backup service mounts the host SQLite data directory read-only, writes `.sqlite` and `.sqlite.json` files to the separate host backup directory, sets those files to `0600`, and prunes files older than the retention period. It does not start the Web server or run migrations, and it receives no application secrets. Schedule the same command from Linux cron or a systemd timer; see [backup and recovery](docs/backup-and-recovery.md) for the absolute-path example, encrypted offsite copies, restore procedure, and independent `SETTINGS_ENCRYPTION_KEY` custody. A persistent host directory is still not an independent backup.

## Backup and recovery

For local development, create a consistent SQLite snapshot while the app is running:

```bash
npm run data:backup
```

Backups and their SHA-256 manifests are written to the ignored `backups/` directory. To restore one, stop the Web server first and pass the explicit confirmation flag:

```bash
npm run data:restore -- --from backups/<snapshot>.sqlite --confirm
```

Restore validates the SQLite header and manifest, then keeps the current database in `backups/pre-restore-*` before replacing it.

For production Linux scheduling, encrypted offsite storage, UID/GID `1001` directory ownership, and the stop/validate/restore/health-check runbook, see [backup and recovery](docs/backup-and-recovery.md).

## Privacy and release

- [Privacy notice](docs/privacy-policy.md)
- [Data export and account deletion](docs/data-deletion.md)
- [Release checklist](docs/release-checklist.md)
