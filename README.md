# Healthy Body Manager

Healthy Body Manager is a personal training, recovery, schedule, and nutrition planning prototype. It combines a Next.js Web App with a rule-based planning engine and a conversational Agent shell.

## First Version

- Self-service registration with email verification, plus email/password login and user-scoped data.
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

## Accounts and registration

Anyone can create an account at `/register`. Registration stores the account in an unverified state and emails a verification link that is valid for 24 hours; login returns `403 email_unverified` until that link is opened, so an unverified account can never obtain a session. `/login`, `/register`, and the expired-link screen can all request a fresh email.

Registration and resend responses are deliberately identical whether or not the address already has an account, so neither endpoint can be used to discover which emails are registered. Registering an address that already has a verified account notifies its owner by email instead of creating a duplicate. Both endpoints are rate limited per IP and per address.

`npm run owner:setup` still works and remains the way to provision an account without a working mailbox, for example during the initial deployment. Accounts it creates are marked verified and skip the email flow.

Verification links are built from `HBM_APP_BASE_URL` rather than the request `Host` header, so that value must match the public origin.

| Endpoint | Purpose |
| --- | --- |
| `POST /api/v1/auth/register` | Create an unverified account and send a verification link |
| `POST /api/v1/auth/verify-email` | Exchange a link token for a verified account |
| `POST /api/v1/auth/resend-verification` | Send a fresh verification link |

### Email delivery

`HBM_EMAIL_TRANSPORT=console` (the local default) prints messages to the server log, so registration can be exercised without a mail provider: copy the verification URL out of the terminal. Production requires `HBM_EMAIL_TRANSPORT=smtp` together with `HBM_SMTP_HOST`, `HBM_EMAIL_FROM`, and, for authenticating relays, `HBM_SMTP_USER` and `HBM_SMTP_PASSWORD`. `HBM_SMTP_PORT` defaults to `587`, and port `465` implies TLS.

## Model configuration

Choosing a provider is the whole configuration; the model name and base URL come from the provider table in `src/settings/defaults.ts` and are never accepted from the client. The only field either client asks for is the API key, which is stored encrypted.

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

Every provider in that table has a neighbouring product whose keys look identical but are issued by a separate account system, and the resulting `401` is indistinguishable from an expired key. Each entry therefore carries a `credentialSource` string naming the platform that issues a working key, and both the chat path and `Test model` append it to any 401 or 403. Kimi is the sharpest case: a `sk-kim` key from the Kimi Code coding membership (`api.kimi.com/coding/v1`) is rejected by the Open Platform endpoint this provider targets. Point `Custom` at the coding endpoint with model `kimi-for-coding` to use one of those keys.

### COROS authorization from the iOS app

COROS authenticates over OAuth, which has to run in a real browser. The app cannot simply open the start URL, because a browser navigation carries neither the app's `Authorization: Bearer` header nor the web session cookie. Instead:

1. The app pins the COROS region via `POST /api/v1/settings/mcp/coros/prep`.
2. `POST /api/v1/settings/mcp/oauth/handoff?connection=coros` returns a start URL carrying a single-use token that expires in five minutes.
3. The app opens that URL in the system browser. `GET /api/settings/mcp/oauth/start` spends the token, resolves the user, and redirects to COROS.
4. The callback redirects to `HBM_APP_OAUTH_RETURN_URL` (default `hbm://mcp-oauth`) so the in-app browser dismisses itself and the app refreshes its settings.

The handoff token is stored hashed under its own session kind, so it can never be replayed as an access token or a cookie session. Set `HBM_APP_OAUTH_RETURN_URL` if the app ships under a scheme other than `hbm`.

## Development

```bash
npm install
cp .env.example .env
npm run prisma:generate
npx prisma migrate deploy
npm run dev
```

Open the local URL printed by Next.js, register at `/register`, then copy the verification link from the terminal (the console email transport prints it). Alternatively, provision an account directly and skip the email step:

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

The production container keeps SQLite under a named `/data` volume, applies committed Prisma migrations before every start, runs as an unprivileged user, and exposes `/api/health` as its container health check. Data is scoped per user, but the deployment is still single-instance: do not run multiple replicas against the same SQLite file. SQLite also bounds how many concurrent accounts this setup can serve, so an installation that opens registration to a wide audience should move to Postgres first.

Generate and store a stable 32-byte settings encryption key in the deployment environment, configure the public origin and an SMTP relay so verification emails can be delivered, then build and start the service behind an HTTPS reverse proxy:

```bash
export SETTINGS_ENCRYPTION_KEY="$(openssl rand -base64 32)"
export HBM_APP_BASE_URL="https://hbm.example.com"
export HBM_EMAIL_TRANSPORT="smtp"
export HBM_EMAIL_FROM="Healthy Body Manager <no-reply@example.com>"
export HBM_SMTP_HOST="smtp.example.com"
export HBM_SMTP_USER="apikey"
export HBM_SMTP_PASSWORD="replace-with-the-smtp-password"
docker compose -f compose.production.yml up -d --build
docker compose -f compose.production.yml ps
```

The app refuses to start a registration if `HBM_APP_BASE_URL`, `HBM_EMAIL_TRANSPORT`, or `HBM_EMAIL_FROM` are missing in production, rather than sending links that point at the wrong host.

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
