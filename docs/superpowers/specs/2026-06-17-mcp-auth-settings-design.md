# MCP Auth Settings Design

## Goal

Make the Settings page support real login-capable MCP connection configuration, including encrypted credentials, authenticated endpoint testing, and an OAuth2 authorization-code callback path.

## Scope

This feature extends the existing three Data MCP connection cards: COROS, Calendar, and Meal Menu. Each card keeps its existing descriptor fields and adds an authentication configuration. Existing saved settings remain valid and load as unauthenticated connections.

Supported authentication modes:

- `none`: no credentials are sent.
- `bearer`: encrypted bearer token sent as `Authorization: Bearer <token>`.
- `api_key`: encrypted API key sent in a configurable header name.
- `basic`: encrypted password sent with username as a Basic auth header.
- `oauth2`: OAuth2 authorization-code login with authorize URL, token URL, client ID, encrypted client secret, scopes, encrypted access token, encrypted refresh token, token expiry, and callback state.

## Data Model

The app will continue storing MCP connection settings inside `UserSettings.dataMcpConnectionsJson`. This avoids adding provider-specific tables and preserves the existing settings page contract. Sensitive MCP auth values are encrypted using the existing AES-GCM settings encryption helper, generalized from API keys to reusable secret encryption helpers.

The sanitized Settings view sent to the browser includes only hints such as `Configured · ...abcd`, never plaintext secrets.

## User Flow

For token-style auth, the user selects an auth type, enters credentials, saves settings, then clicks `Test`. Test requests include the configured authentication headers.

For OAuth2, the user fills authorize URL, token URL, client ID, optional client secret, scopes, and endpoint, then saves settings. The card shows a `Login` link that opens `/api/settings/mcp/oauth/start?connection=<id>`. The start route records a signed state in the saved settings and redirects to the provider authorize URL with `response_type=code`, `client_id`, `scope`, `state`, and app callback URL. The callback route verifies state, exchanges `code` at the token URL, encrypts returned tokens, stores expiry metadata, and redirects back to `/settings?mcp=<id>&auth=connected`.

## Error Handling

Settings validation rejects invalid URLs and invalid auth combinations. OAuth start fails clearly when authorize URL, token URL, or client ID is missing. OAuth callback rejects invalid state and token exchange failures. MCP endpoint tests report unauthenticated 401/403 responses as authentication failures.

## Testing

Service tests cover saving sanitized auth settings, preserving existing credentials when secret inputs are blank, building authenticated endpoint test headers, and OAuth token exchange persistence. API tests cover OAuth start redirect and callback behavior. Component tests cover auth fields and the OAuth login link.
