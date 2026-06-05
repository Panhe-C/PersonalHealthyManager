"use client";

import React, { useState, type FormEvent } from "react";
import { FlaskConical, Save } from "lucide-react";
import { modelProviders, type DataMcpConnection, type SettingsView } from "@/src/settings/defaults";

type TestResult = {
  id: string;
  label: string;
  status: "connected" | "failed" | "not_configured";
  message: string;
  latencyMs: number | null;
};

const statusLabel = {
  connected: "Connected",
  failed: "Failed",
  not_configured: "Not configured"
};

function resultClass(status: TestResult["status"]) {
  if (status === "connected") return "test-result test-result-positive";
  if (status === "failed") return "test-result test-result-warn";
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

  function updateConnection(id: DataMcpConnection["id"], updates: Partial<DataMcpConnection>) {
    setConnections((items) => items.map((item) => (item.id === id ? { ...item, ...updates } : item)));
    setTestResults([]);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    const response = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        modelProvider,
        modelName,
        modelBaseUrl,
        apiKey,
        dataMcpConnections: connections
      })
    });
    const body = await response.json();

    if (!response.ok) {
      setError(body.error ?? "Settings could not be saved");
      setSaving(false);
      return;
    }

    setModelProvider(body.modelProvider);
    setModelName(body.modelName);
    setModelBaseUrl(body.modelBaseUrl);
    setConnections(body.dataMcpConnections);
    setHasApiKey(body.hasApiKey);
    setApiKeyHint(body.apiKeyHint);
    setApiKey("");
    setMessage("Settings saved");
    setSaving(false);
  }

  async function runTest(target: string) {
    setTestingTarget(target);
    setError("");

    const response = await fetch("/api/settings/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target })
    });
    const body = await response.json();

    if (!response.ok) {
      setError(body.error ?? "Settings test failed");
      setTestingTarget(null);
      return;
    }

    setTestResults(body.results ?? []);
    setTestingTarget(null);
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
            <select value={modelProvider} onChange={(event) => setModelProvider(event.target.value as SettingsView["modelProvider"])}>
              {modelProviders.map((provider) => (
                <option value={provider.value} key={provider.value}>
                  {provider.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Model
            <input value={modelName} onChange={(event) => setModelName(event.target.value)} placeholder="gpt-4o-mini" required />
          </label>
          <label className="field field-span">
            Base URL
            <input value={modelBaseUrl} onChange={(event) => setModelBaseUrl(event.target.value)} placeholder="https://api.openai.com/v1" />
          </label>
          <label className="field field-span">
            API key
            <input
              autoComplete="new-password"
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
      </section>

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
                <input value={connection.serverName} onChange={(event) => updateConnection(connection.id, { serverName: event.target.value })} />
              </label>
              <label className="field">
                Capability
                <input
                  value={connection.capabilityName}
                  onChange={(event) => updateConnection(connection.id, { capabilityName: event.target.value })}
                />
              </label>
              <label className="field">
                Endpoint
                <input value={connection.endpoint} onChange={(event) => updateConnection(connection.id, { endpoint: event.target.value })} />
              </label>
              <label className="field">
                Notes
                <textarea rows={3} value={connection.notes} onChange={(event) => updateConnection(connection.id, { notes: event.target.value })} />
              </label>
            </article>
          ))}
        </div>
      </section>

      {testResults.length > 0 ? (
        <section className="surface panel settings-panel">
          <div className="panel-heading">
            <div>
              <h2>Test results</h2>
              <p className="page-subtitle">Latest connection check output.</p>
            </div>
          </div>
          <div className="test-result-list">
            {testResults.map((result) => (
              <div className={resultClass(result.status)} key={result.id}>
                <strong>{result.label}</strong>
                <span>{statusLabel[result.status]}</span>
                <p>{result.message}</p>
                {result.latencyMs != null ? <small>{result.latencyMs} ms</small> : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

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
