# Settings Configuration Page

## Summary

Healthy Body Manager will add a user-facing Settings page where each signed-in user can configure model runtime credentials and data MCP connection preferences. The page must make configuration status visible, allow safe updates, and provide explicit test actions so users can verify that the model provider and data connections are usable before relying on the planning agent.

## Confirmed Direction

- API keys are saved in the local database and encrypted server-side.
- The UI never displays a full API key after save.
- Users can configure model provider, model name, optional base URL, and API key.
- Users can configure data MCP connections for COROS, Calendar, and Meal Menu.
- Users can test each connection individually and run all enabled tests together.
- The feature should match the current Recovery Journal visual system and top navigation.

## Scope

This feature adds configuration storage and verification surfaces. It does not replace the current planning engine, COROS provider, calendar provider, meal menu provider, or agent response logic. Existing APIs and provider mocks continue to work as they do now.

## User Experience

The authenticated app gains a `Settings` navigation item. The Settings page is compact and work-focused, with two main sections:

- `Model runtime`
- `Data MCP connections`

The Model runtime section contains controls for:

- Provider: `OpenAI`, `Anthropic`, or `Custom`
- Model name
- Base URL
- API key

After a key is saved, the page shows a masked status such as `Configured · ending in sk-...1234` or `Configured · ending in ...1234`, depending on the key shape. The API key input remains blank on page load. Leaving the API key field blank while saving preserves the stored key. A `Clear key` action is out of scope for the first version.

The Data MCP section contains one card per source:

- COROS
- Calendar
- Meal Menu

Each source has:

- Enabled toggle
- MCP server name
- Capability or tool name
- Optional endpoint or note field
- Status summary
- Individual `Test` button

The page header includes `Run all tests`, which tests the saved model settings and every enabled data MCP source.

## Security

API keys are encrypted before they are stored in the database. The database stores:

- encrypted ciphertext
- initialization vector
- authentication tag
- provider metadata
- a short non-sensitive key hint

The encryption key comes from `SETTINGS_ENCRYPTION_KEY`. The expected value is either:

- 32 raw characters, or
- a base64 string that decodes to 32 bytes

In development, if the environment variable is absent, the server uses a deterministic development fallback and marks it as development-only. Production must not silently use the fallback.

API responses never return the full plaintext API key. Test responses never include request headers, decrypted key material, or full provider responses.

## Data Model

Add a single user-scoped Prisma model:

```prisma
model UserSettings {
  id                      String   @id @default(cuid())
  userId                  String   @unique
  modelProvider           String   @default("openai")
  modelName               String   @default("gpt-4o-mini")
  modelBaseUrl            String?
  encryptedApiKey         String?
  apiKeyIv                String?
  apiKeyTag               String?
  apiKeyHint              String?
  dataMcpConnectionsJson  String
  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

`dataMcpConnectionsJson` stores an array of:

```ts
type DataMcpConnection = {
  id: "coros" | "calendar" | "meal_menu";
  label: string;
  enabled: boolean;
  serverName: string;
  capabilityName: string;
  endpoint: string;
  notes: string;
};
```

The default data MCP configuration is:

- COROS: enabled, server `coros`, capability `daily-health`
- Calendar: enabled, server `calendar`, capability `agenda`
- Meal Menu: enabled, server `meal-menu`, capability `today-menu`

## API

Add `GET /api/settings`.

Response:

```ts
type SettingsResponse = {
  modelProvider: string;
  modelName: string;
  modelBaseUrl: string;
  hasApiKey: boolean;
  apiKeyHint: string | null;
  dataMcpConnections: DataMcpConnection[];
};
```

Add `POST /api/settings`.

Request:

```ts
type SettingsSaveRequest = {
  modelProvider: "openai" | "anthropic" | "custom";
  modelName: string;
  modelBaseUrl: string;
  apiKey?: string;
  dataMcpConnections: DataMcpConnection[];
};
```

If `apiKey` is omitted or blank, the existing encrypted key is preserved. If no previous key exists, `hasApiKey` remains false.

Add `POST /api/settings/test`.

Request:

```ts
type SettingsTestRequest = {
  target: "model" | "coros" | "calendar" | "meal_menu" | "all";
};
```

Response:

```ts
type SettingsTestResult = {
  id: string;
  label: string;
  status: "connected" | "failed" | "not_configured";
  message: string;
  latencyMs: number | null;
};
```

`all` returns one result for the model configuration and one result for every enabled data MCP connection.

## Testing Behavior

Model testing validates saved configuration and attempts a lightweight provider-specific request when enough information exists.

For the first version:

- `openai` tests `POST /chat/completions` against `modelBaseUrl || https://api.openai.com/v1`.
- `anthropic` tests `POST /messages` against `modelBaseUrl || https://api.anthropic.com/v1`.
- `custom` tests `GET {modelBaseUrl}` if base URL exists; otherwise it fails as not configured.

Network failures, 401/403, 404, and malformed URLs are converted into readable messages.

Data MCP tests are local readiness checks in this web app version. They verify that the connection is enabled and has a server name and capability name. If an endpoint is provided, the test attempts a lightweight `GET` with a short timeout. If no endpoint exists, the test reports `connected` with a message that the MCP descriptor is configured but not network-tested. This keeps the UI useful without pretending the web server can directly invoke Codex-side MCP tools.

## Components

Create these focused units:

- `src/settings/crypto.ts`: encryption and decryption helpers.
- `src/settings/defaults.ts`: default settings and connection definitions.
- `src/settings/service.ts`: database mapping, validation, save/load behavior, and test orchestration.
- `components/SettingsForm.tsx`: interactive client form and test buttons.
- `app/(dashboard)/settings/page.tsx`: server page composition.
- `app/api/settings/route.ts`: load and save API.
- `app/api/settings/test/route.ts`: test API.

Update:

- `components/AppNavigation.tsx`: add Settings nav item and active state.
- `app/globals.css`: add Settings page, connection cards, masked key, and test result styles.

## Error Handling

Invalid provider, missing model name, malformed model base URL, and malformed data MCP connection payloads return `400`.

Save errors show an inline error in the Settings page. Test failures do not block saving and are shown per connection. The UI keeps the latest test result visible until the user changes form values or runs another test.

## Accessibility

All controls use real labels. API key inputs use password type and browser autocomplete hints. Toggle controls are standard checkboxes. Test buttons show loading text while requests are in flight and preserve accessible button text.

## Verification

Automated tests cover:

- encryption round trip and masked hints
- settings load/save behavior preserving existing API key
- test result behavior for missing keys, configured MCP descriptors, and failed network checks
- navigation active state for `/settings`
- Settings form can render saved masked key state and trigger tests

Manual/browser verification covers:

- `/settings` renders in the authenticated app
- saving provider/model/data MCP settings works
- blank API key preserves the existing key
- individual and all test buttons display readable results
- full API key is never displayed after save
- Settings page is responsive at desktop and mobile widths

## Out of Scope

- Rotating or clearing API keys
- Real Codex MCP invocation from the web server
- Multi-key provider vault
- Per-goal provider overrides
- Replacing the current agent with LLM-backed responses
- OAuth flows for provider accounts
