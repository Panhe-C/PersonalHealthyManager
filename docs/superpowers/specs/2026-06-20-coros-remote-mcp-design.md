# COROS Remote MCP Integration Design

## Goal

Connect Healthy Body Manager to COROS through the official remote MCP URLs shown in the COROS setup guide, so the website can authenticate a COROS account and sync real training, sleep, recovery, HRV, and training-load data from inside the app.

The website should treat COROS as a first-class data source. Users should not have to understand generic MCP server configuration, hand-enter OAuth internals, install `coros-mcp`, or provide their COROS password to Healthy Body Manager.

## Scope

In scope:

- Add a COROS-specific connection flow in Settings.
- Let the user choose the COROS MCP region:
  - China: `https://mcpcn.coros.com/mcp`
  - North America or other regions: `https://mcpus.coros.com/mcp`
  - Europe: `https://mcpeu.coros.com/mcp`
- Store the selected remote MCP URL in the existing COROS Data MCP connection settings.
- Start and complete OAuth through the COROS remote MCP server.
- Store returned tokens through the existing encrypted Settings secret flow.
- Call COROS MCP tools from the server side and normalize their responses into the existing COROS import payload shape.
- Keep the current `Sync COROS data` button and `/api/sync/coros` API surface.

Out of scope:

- Installing or managing the `coros-mcp` npm package for desktop MCP clients.
- Asking the user for a COROS password inside the website.
- Supporting every possible third-party MCP client.
- Rebuilding Settings as a provider marketplace.
- Writing calendar or nutrition data through COROS.

## User Flow

On `/settings`, the COROS Data MCP card becomes a guided COROS connection rather than a generic blank MCP card.

1. The user selects a COROS region.
2. The app automatically fills the matching MCP URL.
3. The user clicks `Connect COROS`.
4. The server starts remote MCP OAuth against the selected COROS MCP URL.
5. COROS handles account login and consent on its own domain.
6. COROS redirects back to `/api/settings/mcp/oauth/callback`.
7. The app stores encrypted OAuth tokens and redirects to `/settings?mcp=coros&auth=connected`.
8. The user clicks `Test` or goes to Profile and clicks `Sync COROS data`.

The Profile sync experience should stay simple. The button keeps posting an empty body to `/api/sync/coros`; the server decides whether the saved COROS connection is ready and then pulls data through remote MCP.

## Architecture

### Settings UI

The COROS card should add a small connection assistant above or beside the generic fields:

- `Region` select with China, North America or other regions, and Europe.
- A read-only or auto-managed MCP URL preview.
- `Connect COROS` action for OAuth.
- A connection status that uses existing token hints and test results.

Generic endpoint and auth fields can remain available for advanced debugging, but the recommended path should be obvious and prefilled.

### Settings Model

Keep using `UserSettings.dataMcpConnectionsJson` for the COROS connection. Add minimal COROS-specific metadata only if needed, such as:

```ts
corosRegion?: "china" | "us" | "eu";
```

The existing `endpoint`, `auth`, and encrypted token fields remain the source of truth for server sync.

### Remote MCP Client

Add a server-side COROS MCP client module with a narrow interface:

```ts
type CorosRemoteMcpSnapshot = {
  activities: unknown[];
  sleep: unknown[];
  recovery: unknown[];
};

async function fetchCorosRemoteMcpSnapshot(connection: DataMcpConnection): Promise<CorosRemoteMcpSnapshot>;
```

The module owns MCP protocol details. `syncService` should not know how to initialize remote MCP sessions, list tools, or call tools. It should only receive a normalized snapshot and pass it to the existing import path.

The implementation should prefer the official MCP TypeScript SDK if it supports remote HTTP/SSE MCP with OAuth cleanly in this Next.js runtime. If the SDK is not practical, use a small HTTP client for the remote MCP transport, but keep it isolated behind the same module boundary.

### Tool Selection

COROS remote MCP tool names may differ from the local app's current normalized payload names. The client should discover tools or call known COROS tools through a small mapping layer. The mapping should be tolerant and explicit:

- Activities or workout records become `activities`.
- Sleep summaries become `sleep`.
- Recovery, HRV, resting heart rate, stress, and training load become `recovery`.

If a tool is missing, sync should import the available categories and return a clear partial-sync message rather than failing all data.

### Sync API

`/api/sync/coros` keeps its current two modes:

- Explicit `activities`, `sleep`, or `recovery` payloads continue to import fixtures for tests and development.
- Empty or implicit bodies use saved Settings and fetch from COROS remote MCP.

`syncCorosFromSettings(userId)` changes from a plain authenticated `GET` to:

1. Load the saved COROS connection.
2. Confirm it is enabled and has an endpoint.
3. Confirm OAuth tokens are available.
4. Call the COROS remote MCP client.
5. Normalize and import the payload.

## OAuth

The current generic OAuth routes can remain:

- `/api/settings/mcp/oauth/start?connection=coros`
- `/api/settings/mcp/oauth/callback`

The COROS-specific UI should preconfigure whatever the remote MCP OAuth start flow needs. If COROS remote MCP performs OAuth through MCP metadata instead of static authorize/token URLs, the start route should branch for COROS and delegate to the COROS MCP client instead of requiring manually entered OAuth URLs.

The callback should continue storing only encrypted tokens and non-secret metadata. It should never store COROS account passwords.

## Error Handling

User-facing errors should be specific:

- No region selected: ask the user to choose a COROS region.
- No OAuth token: ask the user to connect COROS.
- OAuth callback failed: show the provider error if available.
- MCP server unreachable: show the selected MCP URL and suggest checking region/network.
- No compatible COROS tools found: explain that the MCP connection worked but did not expose expected training or health tools.
- Partial tool failure: import available data and report which category failed.

The Settings test flow should continue distinguishing authentication-required failures from generic endpoint failures.

## Testing

Add or update unit tests for:

- COROS region selection maps to the three official MCP URLs.
- Saving Settings preserves COROS endpoint, region metadata, and encrypted OAuth tokens.
- COROS OAuth start branches correctly for the guided COROS remote MCP flow.
- `syncCorosFromSettings` calls the remote MCP client instead of plain `GET`.
- Remote MCP snapshots normalize into existing `activities`, `sleep`, and `recovery` imports.
- Missing tokens, missing endpoint, HTTP/MCP failures, and missing tools produce clear errors.

Add or update component tests for:

- The COROS card renders region choices and auto-fills the official MCP URL.
- `Connect COROS` routes through the OAuth start endpoint.
- Existing advanced fields still allow manual endpoint debugging.
- The Profile sync button still calls `/api/sync/coros` with an empty body.

## Acceptance Criteria

- A user can connect COROS from Settings by choosing a region and authorizing through COROS.
- The three official COROS MCP URLs from the setup guide are available in the UI.
- The app stores COROS credentials only as encrypted OAuth tokens.
- `Sync COROS data` pulls from COROS remote MCP rather than doing a plain endpoint `GET`.
- Explicit fixture payload imports still work for tests and development.
- Failed connection, missing auth, and missing tool cases produce actionable messages.
