"use client";

import React, { useMemo, useState, type FormEvent } from "react";
import { FlaskConical, Save } from "lucide-react";
import { modelProviders, type DataMcpAuthConfig, type DataMcpConnection, type SettingsView } from "@/src/settings/defaults";

type TestResult = {
  id: string;
  label: string;
  status: "connected" | "failed" | "not_configured" | "auth_required";
  message: string;
  latencyMs: number | null;
};

const statusLabel = {
  connected: "Connected",
  failed: "Failed",
  not_configured: "Not configured",
  auth_required: "Login required"
};

function resultClass(status: TestResult["status"]) {
  if (status === "connected") return "test-result test-result-positive";
  if (status === "failed" || status === "auth_required") return "test-result test-result-warn";
  return "test-result";
}

export function SettingsForm({ initialSettings }: { initialSettings: SettingsView }) {
  const [modelProvider, setModelProvider] = useState(initialSettings.modelProvider);
  const [modelName, setModelName] = useState(initialSettings.modelName);
  const [modelBaseUrl, setModelBaseUrl] = useState(initialSettings.modelBaseUrl);
  const [apiKey, setApiKey] = useState("");
  const [hasApiKey, setHasApiKey] = useState(initialSettings.hasApiKey);
  const [apiKeyHint, setApiKeyHint] = useState(initialSettings.apiKeyHint);
  const [connections, setConnections] = useState(initialSettings.dataMcpConnections);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [testingTarget, setTestingTarget] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [loginPromptConnectionId, setLoginPromptConnectionId] = useState<DataMcpConnection["id"] | null>(null);
  const [loginPromptMessage, setLoginPromptMessage] = useState("");
  const [loginPromptError, setLoginPromptError] = useState("");

  const loginPromptConnection = useMemo(
    () => connections.find((connection) => connection.id === loginPromptConnectionId) ?? null,
    [connections, loginPromptConnectionId]
  );

  function updateConnection(id: DataMcpConnection["id"], updates: Partial<DataMcpConnection>) {
    setConnections((items) => items.map((item) => (item.id === id ? { ...item, ...updates } : item)));
    setTestResults([]);
  }

  function updateConnectionAuth(id: DataMcpConnection["id"], updates: Partial<DataMcpAuthConfig>) {
    setConnections((items) =>
      items.map((item) =>
        item.id === id
          ? {
              ...item,
              auth: {
                ...(item.auth ?? { type: "none" }),
                ...updates
              }
            }
          : item
      )
    );
    setTestResults([]);
  }

  function updateModelProvider(value: SettingsView["modelProvider"]) {
    const provider = modelProviders.find((item) => item.value === value);
    setModelProvider(value);
    if (provider) {
      setModelName(provider.defaultModel);
      setModelBaseUrl(provider.defaultBaseUrl);
    }
    setTestResults([]);
  }

  const oauthCallbackMessage = useMemo(() => {
    if (typeof window === "undefined") return "";

    const params = new URLSearchParams(window.location.search);
    const auth = params.get("auth");
    const mcp = params.get("mcp");
    const connection = initialSettings.dataMcpConnections.find((item) => item.id === mcp);

    if (auth === "connected" && connection) return `${connection.label} OAuth connected.`;
    if (auth === "failed") return params.get("error") || "OAuth login failed.";
    return "";
  }, [initialSettings.dataMcpConnections]);

  function buildSettingsDraft() {
    return {
      modelProvider,
      modelName,
      modelBaseUrl,
      apiKey,
      dataMcpConnections: connections
    };
  }

  function applySavedSettings(settings: SettingsView) {
    setModelProvider(settings.modelProvider);
    setModelName(settings.modelName);
    setModelBaseUrl(settings.modelBaseUrl);
    setConnections(settings.dataMcpConnections);
    setHasApiKey(settings.hasApiKey);
    setApiKeyHint(settings.apiKeyHint);
    setApiKey("");
  }

  async function persistSettingsDraft() {
    const response = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildSettingsDraft())
    });
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(body.error ?? "Settings could not be saved");
    }

    applySavedSettings(body);
    return body as SettingsView;
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      await persistSettingsDraft();
      setMessage("Settings saved");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Settings could not be saved");
    } finally {
      setSaving(false);
    }
  }

  async function runTest(target: string) {
    setTestingTarget(target);
    setError("");
    setMessage("");
    setTestResults([]);
    setLoginPromptConnectionId(null);
    setLoginPromptMessage("");
    setLoginPromptError("");

    try {
      const response = await fetch("/api/settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target, draft: buildSettingsDraft() })
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(body.error ?? "Settings test failed");
        return;
      }

      const results = (body.results ?? []) as TestResult[];
      setTestResults(results);
      const authRequiredResult = results.find((result) => result.status === "auth_required");
      if (authRequiredResult) {
        const connection = connections.find((item) => item.id === authRequiredResult.id);
        if (!connection) return;
        setLoginPromptConnectionId(connection.id);
        setLoginPromptMessage(authRequiredResult.message);
      }
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : "Settings test failed");
    } finally {
      setTestingTarget(null);
    }
  }

  function closeLoginPrompt() {
    setLoginPromptConnectionId(null);
    setLoginPromptMessage("");
    setLoginPromptError("");
  }

  async function startLogin() {
    if (!loginPromptConnection) return;

    if (loginPromptConnection.auth?.type === "oauth2") {
      setSaving(true);
      setLoginPromptError("");
      try {
        await persistSettingsDraft();
        window.location.assign(`/api/settings/mcp/oauth/start?connection=${loginPromptConnection.id}`);
      } catch (loginError) {
        setLoginPromptError(loginError instanceof Error ? loginError.message : "Settings could not be saved");
      } finally {
        setSaving(false);
      }
      return;
    }

    if (loginPromptConnection.loginUrl) {
      window.open(loginPromptConnection.loginUrl, "_blank", "noopener,noreferrer");
      return;
    }

    setLoginPromptError("No login URL configured. Configure OAuth2 or a login URL first.");
  }

  function authHint(auth: DataMcpAuthConfig | undefined) {
    if (!auth) return null;
    if (auth.type === "bearer" && auth.tokenHint) return `Bearer token · ${auth.tokenHint}`;
    if (auth.type === "api_key" && auth.apiKeyHint) return `API key · ${auth.apiKeyHint}`;
    if (auth.type === "basic" && auth.passwordHint) return `Basic password · ${auth.passwordHint}`;
    if (auth.type === "oauth2" && auth.accessTokenHint) return `OAuth token · ${auth.accessTokenHint}`;
    return null;
  }

  function renderAuthFields(connection: DataMcpConnection) {
    const auth = connection.auth ?? { type: "none" };
    const hint = authHint(auth);

    return (
      <div className="connection-auth">
        <label className="field">
          Auth type
          <select
            aria-label={`Auth type for ${connection.label}`}
            value={auth.type}
            onChange={(event) => updateConnectionAuth(connection.id, { type: event.target.value as DataMcpAuthConfig["type"] })}
          >
            <option value="none">None</option>
            <option value="bearer">Bearer token</option>
            <option value="api_key">API key header</option>
            <option value="basic">Basic auth</option>
            <option value="oauth2">OAuth2</option>
          </select>
        </label>

        {hint ? <span className="status status-positive secret-status">{hint}</span> : null}

        {auth.type === "bearer" ? (
          <label className="field">
            Bearer token
            <input
              aria-label={`Bearer token for ${connection.label}`}
              autoComplete="new-password"
              type="password"
              value={auth.token ?? ""}
              onChange={(event) => updateConnectionAuth(connection.id, { token: event.target.value })}
              placeholder={auth.tokenHint ? "Leave blank to keep existing token" : "Enter bearer token"}
            />
          </label>
        ) : null}

        {auth.type === "api_key" ? (
          <div className="auth-grid">
            <label className="field">
              Header name
              <input
                aria-label={`API key header for ${connection.label}`}
                value={auth.headerName ?? "x-api-key"}
                onChange={(event) => updateConnectionAuth(connection.id, { headerName: event.target.value })}
              />
            </label>
            <label className="field">
              API key
              <input
                aria-label={`API key for ${connection.label}`}
                autoComplete="new-password"
                type="password"
                value={auth.apiKey ?? ""}
                onChange={(event) => updateConnectionAuth(connection.id, { apiKey: event.target.value })}
                placeholder={auth.apiKeyHint ? "Leave blank to keep existing key" : "Enter API key"}
              />
            </label>
          </div>
        ) : null}

        {auth.type === "basic" ? (
          <div className="auth-grid">
            <label className="field">
              Username
              <input
                aria-label={`Username for ${connection.label}`}
                value={auth.username ?? ""}
                onChange={(event) => updateConnectionAuth(connection.id, { username: event.target.value })}
              />
            </label>
            <label className="field">
              Password
              <input
                aria-label={`Password for ${connection.label}`}
                autoComplete="new-password"
                type="password"
                value={auth.password ?? ""}
                onChange={(event) => updateConnectionAuth(connection.id, { password: event.target.value })}
                placeholder={auth.passwordHint ? "Leave blank to keep existing password" : "Enter password"}
              />
            </label>
          </div>
        ) : null}

        {auth.type === "oauth2" ? (
          <div className="oauth-fields">
            <label className="field">
              Authorize URL
              <input
                aria-label={`Authorize URL for ${connection.label}`}
                value={auth.authorizeUrl ?? ""}
                onChange={(event) => updateConnectionAuth(connection.id, { authorizeUrl: event.target.value })}
                placeholder="https://provider.example/oauth/authorize"
              />
            </label>
            <label className="field">
              Token URL
              <input
                aria-label={`Token URL for ${connection.label}`}
                value={auth.tokenUrl ?? ""}
                onChange={(event) => updateConnectionAuth(connection.id, { tokenUrl: event.target.value })}
                placeholder="https://provider.example/oauth/token"
              />
            </label>
            <div className="auth-grid">
              <label className="field">
                Client ID
                <input
                  aria-label={`Client ID for ${connection.label}`}
                  value={auth.clientId ?? ""}
                  onChange={(event) => updateConnectionAuth(connection.id, { clientId: event.target.value })}
                />
              </label>
              <label className="field">
                Client secret
                <input
                  aria-label={`Client secret for ${connection.label}`}
                  autoComplete="new-password"
                  type="password"
                  value={auth.clientSecret ?? ""}
                  onChange={(event) => updateConnectionAuth(connection.id, { clientSecret: event.target.value })}
                  placeholder={auth.clientSecretHint ? "Leave blank to keep existing secret" : "Optional client secret"}
                />
              </label>
            </div>
            <label className="field">
              Scopes
              <input
                aria-label={`Scopes for ${connection.label}`}
                value={auth.scopes ?? ""}
                onChange={(event) => updateConnectionAuth(connection.id, { scopes: event.target.value })}
                placeholder="read write"
              />
            </label>
            <div className="oauth-actions">
              <a className="button" href={`/api/settings/mcp/oauth/start?connection=${connection.id}`}>
                Login {connection.label}
              </a>
              {auth.expiresAt ? <span className="status">Expires {new Date(auth.expiresAt).toLocaleString()}</span> : null}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <form className="settings-grid" onSubmit={save}>
      <section className="surface panel settings-panel">
        <div className="panel-heading">
          <div>
            <h2>Model runtime</h2>
            <p className="page-subtitle">Provider, model, base URL, and encrypted API key storage.</p>
          </div>
          <button className="button" type="button" onClick={() => runTest("all")} disabled={testingTarget !== null}>
            <FlaskConical aria-hidden="true" size={16} />
            {testingTarget === "all" ? "Testing..." : "Run all tests"}
          </button>
        </div>

        <div className="grid form-grid">
          <label className="field">
            Provider
            <select
              name="modelProvider"
              value={modelProvider}
              onChange={(event) => updateModelProvider(event.target.value as SettingsView["modelProvider"])}
            >
              {modelProviders.map((provider) => (
                <option value={provider.value} key={provider.value}>
                  {provider.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Model
            <input
              name="modelName"
              value={modelName}
              onChange={(event) => setModelName(event.target.value)}
              placeholder="gpt-4o-mini"
              required
            />
          </label>
          <label className="field field-span">
            Base URL
            <input
              name="modelBaseUrl"
              value={modelBaseUrl}
              onChange={(event) => setModelBaseUrl(event.target.value)}
              placeholder="https://api.openai.com/v1"
            />
          </label>
          <label className="field field-span">
            API key
            <input
              autoComplete="new-password"
              name="apiKey"
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={hasApiKey ? "Leave blank to keep existing key" : "Enter API key"}
            />
          </label>
        </div>

        <div className="settings-status-line">
          <span className={hasApiKey ? "status status-positive" : "status status-warn"}>
            {hasApiKey ? `Configured · ${apiKeyHint}` : "API key not configured"}
          </span>
          <button className="button" type="button" onClick={() => runTest("model")} disabled={testingTarget !== null}>
            <FlaskConical aria-hidden="true" size={16} />
            {testingTarget === "model" ? "Testing..." : "Test model"}
          </button>
        </div>

        {testingTarget === "model" ? (
          <div className="test-result-list" role="status" aria-live="polite">
            <div className="test-result">
              <strong>Model runtime</strong>
              <span>Testing</span>
              <p>Testing model runtime...</p>
            </div>
          </div>
        ) : null}

        {testResults.length > 0 ? (
          <div className="test-result-list">
            {testResults.map((result) => (
              <div className={resultClass(result.status)} key={result.id}>
                <strong>{result.label}</strong>
                <span>{statusLabel[result.status]}</span>
                <p>{result.status === "auth_required" ? "Open the login prompt to continue." : result.message}</p>
                {result.latencyMs != null ? <small>{result.latencyMs} ms</small> : null}
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {oauthCallbackMessage ? (
        <div className={oauthCallbackMessage.includes("failed") ? "message message-error" : "message"} role="status">
          {oauthCallbackMessage}
        </div>
      ) : null}

      {loginPromptConnection ? (
        <div className="modal-backdrop">
          <section
            aria-labelledby="login-prompt-title"
            aria-modal="true"
            className="modal-panel"
            role="dialog"
          >
            <h2 id="login-prompt-title">{loginPromptConnection.label} login required</h2>
            <p>{loginPromptMessage || "This MCP connection needs authentication before testing can continue."}</p>
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
          </section>
        </div>
      ) : null}

      <section className="surface panel settings-panel">
        <div className="panel-heading">
          <div>
            <h2>Data MCP connections</h2>
            <p className="page-subtitle">Descriptors for the data sources used by planning and recovery checks.</p>
          </div>
        </div>

        <div className="connection-grid">
          {connections.map((connection) => (
            <article className="connection-card" key={connection.id}>
              <div className="connection-card-heading">
                <label className="toggle-field">
                  <input
                    type="checkbox"
                    checked={connection.enabled}
                    onChange={(event) => updateConnection(connection.id, { enabled: event.target.checked })}
                  />
                  <span>{connection.label}</span>
                </label>
                <button className="button" type="button" onClick={() => runTest(connection.id)} disabled={testingTarget !== null}>
                  <FlaskConical aria-hidden="true" size={16} />
                  {testingTarget === connection.id ? "Testing..." : "Test"}
                </button>
              </div>
              <label className="field">
                MCP server
                <input
                  aria-label={`MCP server for ${connection.label}`}
                  value={connection.serverName}
                  onChange={(event) => updateConnection(connection.id, { serverName: event.target.value })}
                />
              </label>
              <label className="field">
                Capability
                <input
                  aria-label={`Capability for ${connection.label}`}
                  value={connection.capabilityName}
                  onChange={(event) => updateConnection(connection.id, { capabilityName: event.target.value })}
                />
              </label>
              <label className="field">
                Endpoint
                <input
                  aria-label={`Endpoint for ${connection.label}`}
                  value={connection.endpoint}
                  onChange={(event) => updateConnection(connection.id, { endpoint: event.target.value })}
                />
              </label>
              <label className="field">
                Login URL
                <input
                  aria-label={`Login URL for ${connection.label}`}
                  value={connection.loginUrl ?? ""}
                  onChange={(event) => updateConnection(connection.id, { loginUrl: event.target.value })}
                  placeholder="https://provider.example/login"
                />
              </label>
              {renderAuthFields(connection)}
              <label className="field">
                Notes
                <textarea
                  aria-label={`Notes for ${connection.label}`}
                  rows={3}
                  value={connection.notes}
                  onChange={(event) => updateConnection(connection.id, { notes: event.target.value })}
                />
              </label>
            </article>
          ))}
        </div>
      </section>

      <div className="toolbar">
        <button className="button button-primary" type="submit" disabled={saving}>
          <Save aria-hidden="true" size={16} />
          {saving ? "Saving..." : "Save settings"}
        </button>
        {message ? <span className="message">{message}</span> : null}
        {error ? (
          <span className="message message-error" role="alert">
            {error}
          </span>
        ) : null}
      </div>
    </form>
  );
}
