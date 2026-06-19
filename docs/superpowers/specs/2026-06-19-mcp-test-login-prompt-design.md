# MCP Test Login Prompt Design

## Goal

When a user tests a Data MCP connection from Settings and that connection needs authentication, the app should show a clear login prompt instead of leaving the user to interpret a failed test. The first target is COROS, but the design should work for Calendar and Meal Menu connections too.

## Scope

This feature extends the existing Settings page Data MCP cards and endpoint test flow. It does not add an MCP installer, does not run shell commands, and does not collect or store COROS account passwords in Healthy Body Manager.

In scope:

- Detect authentication-required test outcomes.
- Show a modal prompt after a test result indicates login is needed.
- Route OAuth2 connections through the existing MCP OAuth start endpoint.
- Support a configured external login URL for non-OAuth MCP bridge flows.
- Keep the existing direct test success and generic failure behavior.

Out of scope:

- Installing stdio MCP servers such as `coros-mcp`.
- Automatically editing local MCP client configuration.
- Handling COROS credentials inside the website.
- Embedding third-party login pages inside an iframe.

## User Flow

On `/settings`, the user configures the COROS Data MCP connection as they do today. The card keeps its existing fields for enabled status, MCP server name, capability name, endpoint, auth type, auth fields, and notes. The card also gains an optional login URL field for providers or MCP bridges that expose a browser login page outside the OAuth2 flow.

When the user clicks `Test`:

1. The browser sends the current Settings draft to `/api/settings/test`.
2. The server tests the selected connection.
3. If the endpoint responds successfully, the UI shows `Connected` as it does today.
4. If the server can tell that login is required, the UI opens a modal titled `COROS login required`.
5. The modal explains that this MCP connection needs authentication before testing can continue.
6. The user can click `Login COROS` or cancel.

The `Login COROS` action follows this priority:

1. If the connection auth type is `oauth2`, open `/api/settings/mcp/oauth/start?connection=coros`.
2. Otherwise, if the connection has a configured login URL, open that URL in a new tab.
3. Otherwise, show a message that no login URL is configured and the user should configure OAuth2 or a login URL first.

After OAuth callback, the existing Settings redirect behavior remains: `/settings?mcp=coros&auth=connected`. The user can then click `Test` again.

## Data Model

`DataMcpConnection` gains an optional field:

```ts
loginUrl?: string;
```

The field is stored inside `UserSettings.dataMcpConnectionsJson` along with the rest of the connection descriptor. It is not secret and does not need encryption. Settings validation should allow an empty value and reject malformed non-empty URLs.

Existing saved connection JSON remains valid. Missing `loginUrl` values should normalize to an empty string in the Settings view.

## API Contract

The Settings test result status expands from:

```ts
"connected" | "failed" | "not_configured"
```

to:

```ts
"connected" | "failed" | "not_configured" | "auth_required"
```

`auth_required` should be returned when:

- An endpoint returns HTTP `401` or `403`.
- An OAuth2 connection is missing an access token.
- A connection requires authentication but no usable auth headers can be built.
- A future MCP bridge returns an explicit login-required shape that the server recognizes.

The result should include the same `id`, `label`, `message`, and `latencyMs` fields already used by the Settings form. The message should be user-facing and specific enough to explain the next action.

## UI Behavior

The Settings form keeps test results visible in the existing result list. For `auth_required`, the result label should show `Login required`.

In addition, the form opens a modal with:

- Title: `<Connection label> login required`
- Body: `This MCP connection needs authentication before testing can continue.`
- Primary action: `Login <Connection label>`
- Secondary action: `Cancel`

The modal should not open for generic failures such as DNS errors, invalid endpoints, or HTTP `500`. Those remain normal failed test results.

The modal should be reusable for all Data MCP connections. It should not hard-code COROS except through the connection label and connection id.

## Security

The website should not collect the user's COROS password for this flow. Authentication should happen either through OAuth2 redirect or through an external MCP bridge login page.

The app should not embed external login pages in an iframe. Opening a new tab or redirecting through the existing OAuth start route avoids mixed-origin form and cookie problems.

The modal should require a direct user click before opening an external page. This avoids surprise navigation and reduces popup-blocking risk.

## Error Handling

If an OAuth2 login is requested before the connection has required OAuth fields, the existing OAuth start route should return a clear error. The Settings UI may surface this after the user returns or if navigation fails.

If a non-OAuth connection has no login URL, the modal should replace the primary action with disabled guidance or show an inline message after click: `No login URL configured. Configure OAuth2 or a login URL first.`

If the user cancels the modal, no Settings data changes. The test result remains visible so the user understands why the connection is not connected.

## Testing

Add or update service tests for:

- Saving and loading a connection with `loginUrl`.
- Rejecting malformed non-empty login URLs.
- Returning `auth_required` for `401` and `403` endpoint responses.
- Returning `auth_required` for OAuth2 connections without an access token.

Add or update component tests for:

- Rendering the login URL field.
- Opening the login-required modal after an `auth_required` test result.
- Routing OAuth2 login to `/api/settings/mcp/oauth/start?connection=coros`.
- Opening a configured external login URL for non-OAuth connections.
- Showing a no-login-URL message when neither OAuth2 nor login URL is available.

## Acceptance Criteria

- Testing a COROS connection that returns `401` or `403` opens a login-required modal.
- OAuth2 COROS login uses the existing OAuth start route.
- Non-OAuth COROS login can use a configured external login URL.
- The app never asks for or stores the user's COROS account password for this flow.
- Existing successful MCP tests still show `Connected`.
- Existing generic endpoint failures still show `Failed` without opening the login modal.
