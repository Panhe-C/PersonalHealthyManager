# MCP Test Login Prompt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Settings connection tests show a login-required modal when COROS or another Data MCP source needs authentication.

**Architecture:** Extend the existing Data MCP connection shape with a non-secret `loginUrl`, then teach the settings service to return a structured `auth_required` status. The Settings form will keep the existing test result list and add a reusable modal that opens OAuth2 login through the existing callback route or opens a configured external login URL for non-OAuth bridge flows.

**Tech Stack:** Next.js App Router, React client component, TypeScript, Prisma-backed settings service, Vitest, React Testing Library.

---

## File Structure

- Modify `src/settings/defaults.ts`: add `loginUrl` to `DataMcpConnection` and default connection records.
- Modify `src/settings/service.ts`: normalize, validate, persist, sanitize, and test `loginUrl`; add `auth_required` to `SettingsTestResult.status`.
- Modify `components/SettingsForm.tsx`: render login URL input, handle `auth_required` test results, and show a reusable login modal.
- Modify `tests/settings/service.test.ts`: cover `loginUrl` persistence, validation, and `auth_required` outcomes.
- Modify `tests/components/SettingsForm.test.tsx`: cover login URL field and modal actions.
- Run existing focused tests, then the full test suite.

---

### Task 1: Extend Data MCP Settings Service

**Files:**
- Modify: `src/settings/defaults.ts`
- Modify: `src/settings/service.ts`
- Test: `tests/settings/service.test.ts`

- [ ] **Step 1: Add failing tests for login URL persistence and validation**

Append these tests inside `describe("settings service", () => { ... })` in `tests/settings/service.test.ts`, before the existing OAuth tests:

```ts
  it("saves and loads a Data MCP login URL", async () => {
    vi.mocked(prisma.userSettings.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.userSettings.upsert).mockResolvedValue({} as never);

    const settings = await saveUserSettings("user-1", {
      modelProvider: "openai",
      modelName: "gpt-4o-mini",
      modelBaseUrl: "https://api.openai.com/v1",
      apiKey: "",
      dataMcpConnections: [
        {
          ...defaultDataMcpConnections[0],
          endpoint: "https://mcp.example.test/coros",
          loginUrl: "https://coros.example.test/login"
        }
      ]
    });

    const [upsertArg] = vi.mocked(prisma.userSettings.upsert).mock.calls.at(0) ?? [];
    const savedConnections = JSON.parse(String(upsertArg?.create?.dataMcpConnectionsJson ?? upsertArg?.update?.dataMcpConnectionsJson));
    expect(savedConnections[0].loginUrl).toBe("https://coros.example.test/login");
    expect(settings.dataMcpConnections[0].loginUrl).toBe("https://coros.example.test/login");
  });

  it("rejects malformed Data MCP login URLs", async () => {
    vi.mocked(prisma.userSettings.findUnique).mockResolvedValue(null);

    await expect(
      saveUserSettings("user-1", {
        modelProvider: "openai",
        modelName: "gpt-4o-mini",
        modelBaseUrl: "https://api.openai.com/v1",
        apiKey: "",
        dataMcpConnections: [
          {
            ...defaultDataMcpConnections[0],
            loginUrl: "not-a-url"
          }
        ]
      })
    ).rejects.toThrow("COROS login URL must be a valid URL");
  });
```

- [ ] **Step 2: Run service tests to verify they fail**

Run:

```bash
npm test -- tests/settings/service.test.ts
```

Expected: FAIL because `loginUrl` is not part of `DataMcpConnection` and is not preserved by `normalizeConnection`.

- [ ] **Step 3: Add `loginUrl` to the Data MCP connection type and defaults**

In `src/settings/defaults.ts`, update `DataMcpConnection`:

```ts
export type DataMcpConnection = {
  id: DataMcpConnectionId;
  label: string;
  enabled: boolean;
  serverName: string;
  capabilityName: string;
  endpoint: string;
  loginUrl: string;
  auth: DataMcpAuthConfig;
  notes: string;
};
```

Add `loginUrl: ""` to each `defaultDataMcpConnections` entry:

```ts
  {
    id: "coros",
    label: "COROS",
    enabled: true,
    serverName: "coros",
    capabilityName: "daily-health",
    endpoint: "",
    loginUrl: "",
    auth: { type: "none" },
    notes: "Workout, sleep, HRV, recovery, and training load."
  },
```

Apply the same `loginUrl: ""` line to the `calendar` and `meal_menu` defaults.

- [ ] **Step 4: Normalize and validate `loginUrl` in the settings service**

In `src/settings/service.ts`, update `normalizeConnection` so it validates the optional URL and preserves it:

```ts
function normalizeConnection(input: DataMcpConnection, existing?: DataMcpConnection): DataMcpConnection {
  if (!knownConnectionIds.has(input.id)) {
    throw new Error("Invalid MCP connection");
  }

  const base = defaultDataMcpConnections.find((connection) => connection.id === input.id);
  if (!base) throw new Error("Invalid MCP connection");

  const endpoint = stringValue(input.endpoint);
  const loginUrl = stringValue(input.loginUrl);
  assertUrl(endpoint, `${base.label} endpoint`);
  assertUrl(loginUrl, `${base.label} login URL`);

  return {
    id: base.id,
    label: base.label,
    enabled: Boolean(input.enabled),
    serverName: stringValue(input.serverName),
    capabilityName: stringValue(input.capabilityName),
    endpoint,
    loginUrl,
    auth: normalizeAuth(input.auth, existing?.auth),
    notes: stringValue(input.notes)
  };
}
```

- [ ] **Step 5: Run service tests to verify login URL tests pass**

Run:

```bash
npm test -- tests/settings/service.test.ts
```

Expected: PASS for the two new login URL tests. Existing tests may now fail only if they asserted exact object shapes without `loginUrl`; update those expectations to use `expect.objectContaining(...)` if needed.

- [ ] **Step 6: Add failing tests for `auth_required` MCP test outcomes**

Append these tests in `tests/settings/service.test.ts`, near `uses configured MCP bearer credentials when testing an endpoint`:

```ts
  it("reports MCP endpoint 401 responses as auth required", async () => {
    const saved = await saveUserSettings("user-1", {
      modelProvider: "openai",
      modelName: "gpt-4o-mini",
      modelBaseUrl: "https://api.openai.com/v1",
      apiKey: "",
      dataMcpConnections: [
        {
          ...defaultDataMcpConnections[0],
          endpoint: "https://mcp.example.test/coros",
          loginUrl: "https://coros.example.test/login",
          auth: { type: "bearer", token: "expired-token-123456" }
        }
      ]
    });
    const [upsertArg] = vi.mocked(prisma.userSettings.upsert).mock.calls.at(0) ?? [];
    vi.mocked(prisma.userSettings.findUnique).mockResolvedValue({
      modelProvider: "openai",
      modelName: "gpt-4o-mini",
      modelBaseUrl: "https://api.openai.com/v1",
      encryptedApiKey: null,
      apiKeyIv: null,
      apiKeyTag: null,
      apiKeyHint: null,
      dataMcpConnectionsJson: String(upsertArg?.create?.dataMcpConnectionsJson ?? upsertArg?.update?.dataMcpConnectionsJson)
    } as never);
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 401 } as never);

    const results = await testUserSettings("user-1", saved.dataMcpConnections[0].id);

    expect(results).toEqual([
      expect.objectContaining({
        id: "coros",
        status: "auth_required",
        message: "COROS login is required before this MCP connection can be tested."
      })
    ]);
  });

  it("reports OAuth2 MCP tests without an access token as auth required", async () => {
    vi.mocked(prisma.userSettings.findUnique).mockResolvedValue({
      modelProvider: "openai",
      modelName: "gpt-4o-mini",
      modelBaseUrl: "https://api.openai.com/v1",
      encryptedApiKey: null,
      apiKeyIv: null,
      apiKeyTag: null,
      apiKeyHint: null,
      dataMcpConnectionsJson: JSON.stringify([
        {
          ...defaultDataMcpConnections[0],
          endpoint: "https://mcp.example.test/coros",
          auth: {
            type: "oauth2",
            authorizeUrl: "https://login.example.test/oauth/authorize",
            tokenUrl: "https://login.example.test/oauth/token",
            clientId: "client-1",
            scopes: "sleep recovery"
          }
        }
      ])
    } as never);

    const results = await testUserSettings("user-1", "coros");

    expect(fetch).not.toHaveBeenCalled();
    expect(results).toEqual([
      expect.objectContaining({
        id: "coros",
        status: "auth_required",
        message: "COROS login is required before this MCP connection can be tested."
      })
    ]);
  });
```

- [ ] **Step 7: Run service tests to verify `auth_required` tests fail**

Run:

```bash
npm test -- tests/settings/service.test.ts
```

Expected: FAIL because `SettingsTestResult.status` does not include `auth_required`, missing OAuth2 tokens currently return `not_configured`, and endpoint `401/403` responses currently return `failed`.

- [ ] **Step 8: Implement structured `auth_required` results**

In `src/settings/service.ts`, update the `SettingsTestResult` type:

```ts
export type SettingsTestResult = {
  id: string;
  label: string;
  status: "connected" | "failed" | "not_configured" | "auth_required";
  message: string;
  latencyMs: number | null;
};
```

Add a helper above `testMcpConnection`:

```ts
function mcpLoginRequiredResult(connection: DataMcpConnection): SettingsTestResult {
  return {
    id: connection.id,
    label: connection.label,
    status: "auth_required",
    message: `${connection.label} login is required before this MCP connection can be tested.`,
    latencyMs: null
  };
}
```

Update the missing-auth branch in `testMcpConnection`:

```ts
  const headers = buildMcpAuthHeaders(connection.auth);
  if (!headers) {
    return mcpLoginRequiredResult(connection);
  }
```

Update the non-OK response branch inside `testMcpConnection`:

```ts
      if (response.status === 401 || response.status === 403) {
        return {
          ...mcpLoginRequiredResult(connection),
          latencyMs: null
        };
      }
      return {
        id: connection.id,
        label: connection.label,
        status: "failed",
        message: `Endpoint returned HTTP ${response.status}.`
      };
```

The `withLatency` wrapper will assign latency to the returned object. Keeping `latencyMs: null` in `mcpLoginRequiredResult` is fine because `withLatency` overwrites it for network responses and leaves it null for preflight missing-token responses.

- [ ] **Step 9: Run focused service tests**

Run:

```bash
npm test -- tests/settings/service.test.ts
```

Expected: PASS.

- [ ] **Step 10: Commit service changes**

Run:

```bash
git add src/settings/defaults.ts src/settings/service.ts tests/settings/service.test.ts
git commit -m "feat: detect mcp login-required tests"
```

Expected: commit succeeds with only service/type/test changes.

---

### Task 2: Add Settings Login Prompt UI

**Files:**
- Modify: `components/SettingsForm.tsx`
- Test: `tests/components/SettingsForm.test.tsx`

- [ ] **Step 1: Add failing component tests for login URL field and OAuth modal routing**

In `tests/components/SettingsForm.test.tsx`, update the test result type expectations by adding tests before `renders OAuth2 fields and login link for an MCP connection`:

```ts
  it("renders and submits a Data MCP login URL", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        modelProvider: "openai",
        modelName: "gpt-4o-mini",
        modelBaseUrl: "https://api.openai.com/v1",
        hasApiKey: false,
        apiKeyHint: null,
        dataMcpConnections: [
          {
            ...defaultDataMcpConnections[0],
            loginUrl: "https://coros.example.test/login"
          },
          defaultDataMcpConnections[1],
          defaultDataMcpConnections[2]
        ]
      })
    } as never);

    render(
      <SettingsForm
        initialSettings={{
          modelProvider: "openai",
          modelName: "gpt-4o-mini",
          modelBaseUrl: "https://api.openai.com/v1",
          hasApiKey: false,
          apiKeyHint: null,
          dataMcpConnections: defaultDataMcpConnections
        }}
      />
    );

    fireEvent.change(screen.getByLabelText("Login URL for COROS"), { target: { value: "https://coros.example.test/login" } });
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/settings",
        expect.objectContaining({
          method: "POST"
        })
      );
    });

    const [, requestInit] = vi.mocked(fetch).mock.calls.at(-1) ?? [];
    const body = JSON.parse(String(requestInit?.body));
    expect(body.dataMcpConnections[0]).toEqual(
      expect.objectContaining({
        id: "coros",
        loginUrl: "https://coros.example.test/login"
      })
    );
  });

  it("opens a login-required modal and routes OAuth2 login through the OAuth start endpoint", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          {
            id: "coros",
            label: "COROS",
            status: "auth_required",
            message: "COROS login is required before this MCP connection can be tested.",
            latencyMs: null
          }
        ]
      })
    } as never);

    const assign = vi.fn();
    Object.defineProperty(window, "location", {
      value: { ...window.location, assign },
      writable: true
    });

    render(
      <SettingsForm
        initialSettings={{
          modelProvider: "openai",
          modelName: "gpt-4o-mini",
          modelBaseUrl: "https://api.openai.com/v1",
          hasApiKey: false,
          apiKeyHint: null,
          dataMcpConnections: [
            {
              ...defaultDataMcpConnections[0],
              auth: {
                type: "oauth2",
                authorizeUrl: "https://login.example.test/oauth/authorize",
                tokenUrl: "https://login.example.test/oauth/token",
                clientId: "client-1",
                scopes: "sleep recovery"
              }
            },
            defaultDataMcpConnections[1],
            defaultDataMcpConnections[2]
          ]
        }}
      />
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Test" })[0]);

    expect(await screen.findByRole("dialog", { name: "COROS login required" })).toBeInTheDocument();
    expect(screen.getByText("COROS login is required before this MCP connection can be tested.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Login COROS" }));

    expect(assign).toHaveBeenCalledWith("/api/settings/mcp/oauth/start?connection=coros");
  });
```

- [ ] **Step 2: Run component tests to verify they fail**

Run:

```bash
npm test -- tests/components/SettingsForm.test.tsx
```

Expected: FAIL because the login URL input and login-required modal do not exist yet.

- [ ] **Step 3: Add `auth_required` UI labels and modal state**

In `components/SettingsForm.tsx`, update `TestResult`:

```ts
type TestResult = {
  id: string;
  label: string;
  status: "connected" | "failed" | "not_configured" | "auth_required";
  message: string;
  latencyMs: number | null;
};
```

Update `statusLabel`:

```ts
const statusLabel = {
  connected: "Connected",
  failed: "Failed",
  not_configured: "Not configured",
  auth_required: "Login required"
};
```

Update `resultClass`:

```ts
function resultClass(status: TestResult["status"]) {
  if (status === "connected") return "test-result test-result-positive";
  if (status === "failed" || status === "auth_required") return "test-result test-result-warn";
  return "test-result";
}
```

Add state near the existing `testResults` state:

```ts
  const [loginPromptConnectionId, setLoginPromptConnectionId] = useState<DataMcpConnection["id"] | null>(null);
  const [loginPromptMessage, setLoginPromptMessage] = useState("");
  const [loginPromptError, setLoginPromptError] = useState("");
```

Add derived connection state after `oauthCallbackMessage`:

```ts
  const loginPromptConnection = useMemo(
    () => connections.find((connection) => connection.id === loginPromptConnectionId) ?? null,
    [connections, loginPromptConnectionId]
  );
```

- [ ] **Step 4: Open the modal when a test returns `auth_required`**

In `runTest`, after `setTestResults(body.results ?? []);`, add:

```ts
      const authRequiredResult = (body.results ?? []).find((result: TestResult) => result.status === "auth_required");
      if (authRequiredResult) {
        setLoginPromptConnectionId(authRequiredResult.id as DataMcpConnection["id"]);
        setLoginPromptMessage(authRequiredResult.message);
        setLoginPromptError("");
      }
```

Also clear modal errors when a test starts:

```ts
    setLoginPromptError("");
```

- [ ] **Step 5: Render and submit the login URL field**

In each connection card in `components/SettingsForm.tsx`, insert this field after the `Endpoint` field:

```tsx
              <label className="field">
                Login URL
                <input
                  aria-label={`Login URL for ${connection.label}`}
                  value={connection.loginUrl}
                  onChange={(event) => updateConnection(connection.id, { loginUrl: event.target.value })}
                  placeholder="https://provider.example/login"
                />
              </label>
```

- [ ] **Step 6: Implement login modal helpers**

Add these functions before the component `return`:

```ts
  function closeLoginPrompt() {
    setLoginPromptConnectionId(null);
    setLoginPromptMessage("");
    setLoginPromptError("");
  }

  function startLogin() {
    if (!loginPromptConnection) return;

    if (loginPromptConnection.auth?.type === "oauth2") {
      window.location.assign(`/api/settings/mcp/oauth/start?connection=${loginPromptConnection.id}`);
      return;
    }

    if (loginPromptConnection.loginUrl) {
      window.open(loginPromptConnection.loginUrl, "_blank", "noopener,noreferrer");
      return;
    }

    setLoginPromptError("No login URL configured. Configure OAuth2 or a login URL first.");
  }
```

Render the modal after the OAuth callback message and before the Data MCP connections section:

```tsx
      {loginPromptConnection ? (
        <div className="modal-backdrop" role="presentation">
          <div className="surface modal-panel" role="dialog" aria-modal="true" aria-labelledby="mcp-login-title">
            <div className="panel-heading">
              <div>
                <h2 id="mcp-login-title">{loginPromptConnection.label} login required</h2>
                <p className="page-subtitle">
                  {loginPromptMessage || "This MCP connection needs authentication before testing can continue."}
                </p>
              </div>
            </div>
            {loginPromptError ? (
              <p className="message message-error" role="alert">
                {loginPromptError}
              </p>
            ) : null}
            <div className="toolbar">
              <button className="button button-primary" type="button" onClick={startLogin}>
                Login {loginPromptConnection.label}
              </button>
              <button className="button" type="button" onClick={closeLoginPrompt}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
```

The existing stylesheet already has `surface`, `panel-heading`, `toolbar`, `message`, and button styles. If `modal-backdrop` or `modal-panel` are not defined, add compact styles in Task 3 after component behavior passes.

- [ ] **Step 7: Run component tests**

Run:

```bash
npm test -- tests/components/SettingsForm.test.tsx
```

Expected: the new login URL and OAuth modal tests PASS. If JSDOM rejects overriding `window.location`, adjust the test to click the existing OAuth link behavior by asserting `window.location.href` ends with `/api/settings/mcp/oauth/start?connection=coros` after the click.

- [ ] **Step 8: Add failing tests for external login URL and missing login URL**

Append these tests in `tests/components/SettingsForm.test.tsx` after the OAuth modal test:

```ts
  it("opens a configured external login URL for non-OAuth MCP login", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          {
            id: "coros",
            label: "COROS",
            status: "auth_required",
            message: "COROS login is required before this MCP connection can be tested.",
            latencyMs: null
          }
        ]
      })
    } as never);
    const open = vi.fn();
    vi.stubGlobal("open", open);

    render(
      <SettingsForm
        initialSettings={{
          modelProvider: "openai",
          modelName: "gpt-4o-mini",
          modelBaseUrl: "https://api.openai.com/v1",
          hasApiKey: false,
          apiKeyHint: null,
          dataMcpConnections: [
            {
              ...defaultDataMcpConnections[0],
              loginUrl: "https://coros.example.test/login",
              auth: { type: "bearer" }
            },
            defaultDataMcpConnections[1],
            defaultDataMcpConnections[2]
          ]
        }}
      />
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Test" })[0]);
    fireEvent.click(await screen.findByRole("button", { name: "Login COROS" }));

    expect(open).toHaveBeenCalledWith("https://coros.example.test/login", "_blank", "noopener,noreferrer");
  });

  it("shows guidance when login is required but no login URL is configured", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          {
            id: "coros",
            label: "COROS",
            status: "auth_required",
            message: "COROS login is required before this MCP connection can be tested.",
            latencyMs: null
          }
        ]
      })
    } as never);

    render(
      <SettingsForm
        initialSettings={{
          modelProvider: "openai",
          modelName: "gpt-4o-mini",
          modelBaseUrl: "https://api.openai.com/v1",
          hasApiKey: false,
          apiKeyHint: null,
          dataMcpConnections: [
            {
              ...defaultDataMcpConnections[0],
              auth: { type: "bearer" }
            },
            defaultDataMcpConnections[1],
            defaultDataMcpConnections[2]
          ]
        }}
      />
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Test" })[0]);
    fireEvent.click(await screen.findByRole("button", { name: "Login COROS" }));

    expect(screen.getByText("No login URL configured. Configure OAuth2 or a login URL first.")).toBeInTheDocument();
  });
```

- [ ] **Step 9: Run component tests to verify all modal cases**

Run:

```bash
npm test -- tests/components/SettingsForm.test.tsx
```

Expected: PASS.

- [ ] **Step 10: Commit UI changes**

Run:

```bash
git add components/SettingsForm.tsx tests/components/SettingsForm.test.tsx
git commit -m "feat: prompt for mcp login from settings tests"
```

Expected: commit succeeds with only Settings form and component test changes.

---

### Task 3: Modal Styling and Full Verification

**Files:**
- Modify: `app/globals.css`
- Test: `tests/settings/service.test.ts`
- Test: `tests/components/SettingsForm.test.tsx`

- [ ] **Step 1: Check whether modal classes already exist**

Run:

```bash
rg -n "modal-backdrop|modal-panel" app/globals.css components
```

Expected: if no results appear, add the styles in the next step. If both classes already exist and render correctly, skip to Step 3.

- [ ] **Step 2: Add compact modal styles**

Add this CSS near the Settings styles in `app/globals.css`:

```css
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgb(15 23 42 / 0.28);
}

.modal-panel {
  width: min(520px, 100%);
  display: grid;
  gap: 18px;
}
```

- [ ] **Step 3: Run focused tests**

Run:

```bash
npm test -- tests/settings/service.test.ts tests/components/SettingsForm.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Run the full test suite**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 5: Build the app**

Run:

```bash
npm run build
```

Expected: PASS. If the build fails because of unrelated local environment or dependency issues, capture the exact error and stop before claiming completion.

- [ ] **Step 6: Commit styling and verification-ready state**

Run:

```bash
git add app/globals.css
git commit -m "style: add mcp login prompt modal"
```

Expected: commit succeeds if CSS changed. If Step 1 found existing modal styles and no CSS changed, do not create an empty commit.

---

## Self-Review Notes

- Spec coverage: Task 1 covers `loginUrl`, URL validation, and `auth_required`; Task 2 covers login modal, OAuth route, external login URL, and missing-login guidance; Task 3 covers modal styling and full verification.
- Security scope: the plan never collects COROS passwords and never embeds external login pages in iframes.
- Type consistency: the new connection field is consistently named `loginUrl`, and the new status is consistently named `auth_required`.
