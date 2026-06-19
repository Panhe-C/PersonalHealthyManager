import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsForm } from "@/components/SettingsForm";
import { defaultDataMcpConnections } from "@/src/settings/defaults";

describe("SettingsForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, "", "/settings");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [{ id: "model", label: "Model runtime", status: "connected", message: "Model responded.", latencyMs: 12 }]
        })
      })
    );
  });

  it("renders masked API key state without exposing the full key", () => {
    render(
      <SettingsForm
        initialSettings={{
          modelProvider: "openai",
          modelName: "gpt-4o-mini",
          modelBaseUrl: "https://api.openai.com/v1",
          hasApiKey: true,
          apiKeyHint: "sk-...1234",
          dataMcpConnections: defaultDataMcpConnections
        }}
      />
    );

    expect(screen.getByText("Configured · sk-...1234")).toBeInTheDocument();
    expect(screen.queryByText("sk-test-1234")).not.toBeInTheDocument();
  });

  it("shows Chinese model providers in the provider picker", () => {
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

    expect(screen.getByRole("option", { name: "DeepSeek" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "MiniMax" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Kimi / Moonshot" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "GLM / Zhipu" })).toBeInTheDocument();
  });

  it("fills provider defaults when the provider changes", () => {
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

    fireEvent.change(screen.getByRole("combobox", { name: "Provider" }), { target: { value: "kimi" } });

    expect(screen.getByRole("textbox", { name: "Model" })).toHaveValue("kimi-k2.6");
    expect(screen.getByRole("textbox", { name: "Base URL" })).toHaveValue("https://api.moonshot.ai/v1");
  });

  it("sends the current model draft when testing the model", async () => {
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

    fireEvent.change(screen.getByRole("combobox", { name: "Provider" }), { target: { value: "deepseek" } });
    fireEvent.change(screen.getByLabelText("API key"), { target: { value: "sk-draft-1234" } });
    fireEvent.click(screen.getByRole("button", { name: "Test model" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/settings/test",
        expect.objectContaining({
          method: "POST"
        })
      );
    });

    const [, requestInit] = vi.mocked(fetch).mock.calls.at(-1) ?? [];
    expect(JSON.parse(String(requestInit?.body))).toEqual({
      target: "model",
      draft: expect.objectContaining({
        modelProvider: "deepseek",
        modelName: "deepseek-v4-flash",
        modelBaseUrl: "https://api.deepseek.com",
        apiKey: "sk-draft-1234"
      })
    });
  });

  it("shows model test progress and then the result after clicking Test model", async () => {
    let resolveFetch: (value: { ok: boolean; json: () => Promise<unknown> }) => void = () => {};
    vi.mocked(fetch).mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }) as never
    );

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

    fireEvent.click(screen.getByRole("button", { name: "Test model" }));

    expect(screen.getByText("Testing model runtime...")).toBeInTheDocument();

    resolveFetch({
      ok: true,
      json: async () => ({
        results: [{ id: "model", label: "Model runtime", status: "connected", message: "Model responded.", latencyMs: 12 }]
      })
    });

    expect(await screen.findByText("Model responded.")).toBeInTheDocument();
    expect(screen.queryByText("Testing model runtime...")).not.toBeInTheDocument();
  });

  it("runs all settings tests from the toolbar", async () => {
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

    fireEvent.click(screen.getByRole("button", { name: "Run all tests" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/settings/test",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("\"target\":\"all\"")
        })
      );
    });
    const [, requestInit] = vi.mocked(fetch).mock.calls.at(-1) ?? [];
    expect(JSON.parse(String(requestInit?.body))).toEqual({
      target: "all",
      draft: expect.objectContaining({
        dataMcpConnections: defaultDataMcpConnections
      })
    });
    expect(await screen.findByText("Model responded.")).toBeInTheDocument();
  });

  it("sends the current MCP draft when testing a connection", async () => {
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

    fireEvent.change(screen.getByLabelText("Auth type for COROS"), { target: { value: "bearer" } });
    fireEvent.change(screen.getByLabelText("Endpoint for COROS"), { target: { value: "https://mcp.example.test/coros" } });
    fireEvent.change(screen.getByLabelText("Bearer token for COROS"), { target: { value: "coros-token-123456" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Test" })[0]);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/settings/test",
        expect.objectContaining({
          method: "POST"
        })
      );
    });

    const [, requestInit] = vi.mocked(fetch).mock.calls.at(-1) ?? [];
    const body = JSON.parse(String(requestInit?.body));
    expect(body).toEqual({
      target: "coros",
      draft: expect.objectContaining({
        dataMcpConnections: expect.arrayContaining([
          expect.objectContaining({
            id: "coros",
            endpoint: "https://mcp.example.test/coros",
            auth: { type: "bearer", token: "coros-token-123456" }
          })
        ])
      })
    });
  });

  it("shows an OAuth callback success message from the current URL", () => {
    window.history.replaceState({}, "", "/settings?mcp=coros&auth=connected");

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

    expect(screen.getByText("COROS OAuth connected.")).toBeInTheDocument();
  });

  it("saves MCP bearer authentication fields with the connection draft", async () => {
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
            endpoint: "https://mcp.example.test/coros",
            auth: { type: "bearer", tokenHint: "...3456" }
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

    fireEvent.change(screen.getByLabelText("Auth type for COROS"), { target: { value: "bearer" } });
    fireEvent.change(screen.getByLabelText("Endpoint for COROS"), { target: { value: "https://mcp.example.test/coros" } });
    fireEvent.change(screen.getByLabelText("Bearer token for COROS"), { target: { value: "coros-token-123456" } });
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
        endpoint: "https://mcp.example.test/coros",
        auth: { type: "bearer", token: "coros-token-123456" }
      })
    );
  });

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
        expect.objectContaining({ method: "POST" })
      );
    });

    const [, requestInit] = vi.mocked(fetch).mock.calls.at(-1) ?? [];
    const body = JSON.parse(String(requestInit?.body));
    expect(body.dataMcpConnections[0]).toEqual(
      expect.objectContaining({ id: "coros", loginUrl: "https://coros.example.test/login" })
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

    const originalLocation = window.location;
    const assign = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, assign }
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
    expect(screen.getByText("Login required")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Login COROS" }));

    expect(assign).toHaveBeenCalledWith("/api/settings/mcp/oauth/start?connection=coros");

    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation
    });
  });

  it("shows fallback guidance when auth-required test result has an empty message", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [{ id: "coros", label: "COROS", status: "auth_required", message: "", latencyMs: null }]
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

    fireEvent.click(screen.getAllByRole("button", { name: "Test" })[0]);

    expect(await screen.findByRole("dialog", { name: "COROS login required" })).toBeInTheDocument();
    expect(screen.getByText("This MCP connection needs authentication before testing can continue.")).toBeInTheDocument();
  });

  it("closes the login-required modal from the secondary Cancel action", async () => {
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
          dataMcpConnections: defaultDataMcpConnections
        }}
      />
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Test" })[0]);

    expect(await screen.findByRole("dialog", { name: "COROS login required" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog", { name: "COROS login required" })).not.toBeInTheDocument();
  });

  it("opens a configured external login URL for non-OAuth MCP login", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          { id: "coros", label: "COROS", status: "auth_required", message: "COROS login is required before this MCP connection can be tested.", latencyMs: null }
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
            { ...defaultDataMcpConnections[0], loginUrl: "https://coros.example.test/login", auth: { type: "bearer" } },
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
          { id: "coros", label: "COROS", status: "auth_required", message: "COROS login is required before this MCP connection can be tested.", latencyMs: null }
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
            { ...defaultDataMcpConnections[0], auth: { type: "bearer" } },
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

  it("renders OAuth2 fields and login link for an MCP connection", () => {
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
                scopes: "sleep recovery",
                accessTokenHint: "...cdef"
              }
            },
            defaultDataMcpConnections[1],
            defaultDataMcpConnections[2]
          ]
        }}
      />
    );

    expect(screen.getByLabelText("Auth type for COROS")).toHaveValue("oauth2");
    expect(screen.getByLabelText("Authorize URL for COROS")).toHaveValue("https://login.example.test/oauth/authorize");
    expect(screen.getByLabelText("Token URL for COROS")).toHaveValue("https://login.example.test/oauth/token");
    expect(screen.getByLabelText("Client ID for COROS")).toHaveValue("client-1");
    expect(screen.getByLabelText("Scopes for COROS")).toHaveValue("sleep recovery");
    expect(screen.getByText("OAuth token · ...cdef")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Login COROS" })).toHaveAttribute(
      "href",
      "/api/settings/mcp/oauth/start?connection=coros"
    );
  });
});
