# Personal iPhone Runtime Design

Date: 2026-07-14
Status: awaiting user review

## Goal

Run Healthy Body Manager on the owner's physical iPhone with real personal data, without App Store distribution. The Mac remains the trusted backend host, SQLite remains the database, and the phone reaches the backend over a private network.

## Scope

This work is split into two independently verifiable stages.

### Stage 1: same-network physical-device pilot

- Start the Next.js backend on all Mac network interfaces instead of loopback only.
- Resolve the mobile API base URL from `EXPO_PUBLIC_API_BASE_URL`, with the existing Expo config value as a development fallback.
- Add a checked-in example environment file for the mobile app without committing a machine-specific IP address.
- Add a small startup/check script that prints the reachable backend URL and verifies the API before Expo starts.
- Run the app through Expo on a physical iPhone connected to the same network.
- Verify login, token refresh, Today, Plan, Insights, Coach, and Settings against the real backend.

Stage 1 succeeds when the iPhone can log in and load real API-backed data while the Mac and iPhone are on the same network.

### Stage 2: private remote access and durable installation

- Install and configure Tailscale on both the Mac and iPhone.
- Point the mobile production environment at the Mac's stable Tailscale address.
- Add a Mac launch configuration for the backend, with logs written outside the database directory.
- Add a daily SQLite backup script with timestamped copies and a retention policy.
- Install a signed development build on the owner's physical iPhone through Xcode or EAS internal distribution, without App Store submission.
- Re-run the full device smoke test over cellular data with Wi-Fi disabled.

Stage 2 succeeds when the iPhone can use the app away from the local Wi-Fi, the Mac backend survives restart, and a database backup can be restored.

## Architecture

```text
Physical iPhone
  -> Expo development build or signed internal build
  -> private LAN during Stage 1
  -> Tailscale private network during Stage 2
  -> Next.js backend on the owner's Mac
  -> Prisma
  -> prisma/dev.db (SQLite)
```

No backend port is exposed directly to the public internet. Tailscale is the remote transport. PostgreSQL and cloud hosting remain outside this scope.

## Configuration Boundaries

- Repository defaults must not contain the owner's LAN or Tailscale address.
- `EXPO_PUBLIC_API_BASE_URL` is the authoritative runtime setting for the mobile API origin.
- `apps/mobile/app.json` keeps a loopback fallback for simulator-only development.
- The backend host command binds to `0.0.0.0`; access control is provided by the local firewall and private network.
- `.env` continues to own `DATABASE_URL`, `SESSION_SECRET`, and `SETTINGS_ENCRYPTION_KEY` and remains ignored by Git.
- Real secrets, Tailscale credentials, Apple signing credentials, and personal IP addresses are never committed.

## Data and Security

- SQLite remains the source of truth for accounts, health data, plans, settings, and Agent history.
- The personal account replaces the shared demo account for daily use.
- Production-like usage must use strong, stable values for `SESSION_SECRET` and `SETTINGS_ENCRYPTION_KEY`.
- Backups copy the SQLite database only after a safe checkpoint or while the backend is stopped, so WAL state is not silently omitted.
- Backup restoration is verified against a temporary database before any destructive replacement of the active database.

## Error Handling

- Mobile startup must report a missing or invalid API base URL clearly.
- The preflight check must distinguish unreachable host, non-HTTP response, and an expected authenticated endpoint response.
- A failed Tailscale connection must not fall back to a public endpoint.
- Backend startup must fail visibly if the configured port is already occupied.
- Device verification must record whether failure comes from network reachability, authentication, API schema validation, or Expo/Xcode signing.

## Testing

- Unit-test API base URL resolution before changing production code.
- Keep the existing mobile API client tests green.
- Run mobile TypeScript checking and the mobile Vitest suite.
- Run the root Vitest suite and Next.js production build.
- Stage 1 manual verification: Safari reachability from iPhone, then login and all five app tabs on the same network.
- Stage 2 manual verification: repeat over cellular through Tailscale, restart the Mac backend, and restore a backup into a temporary path.

## Out of Scope

- App Store submission, store screenshots, review metadata, and public distribution.
- Public account registration, email verification, and password recovery.
- PostgreSQL migration or cloud deployment.
- HealthKit, push notifications, and native MCP OAuth deep links.
- Direct public exposure of the Mac backend.

## Rollout and Stop Conditions

1. Finish Stage 1 and verify it on the owner's physical iPhone before installing Tailscale or creating a signed build.
2. Stop and request user action when macOS, iOS, Tailscale, or Apple signing presents an interactive permission/login screen.
3. Preserve the current dirty worktree; only task-specific files are staged and committed.
4. Do not claim physical-device success until the real iPhone has loaded authenticated data from the backend.
