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

  it("renders the official COROS MCP region selector and URL preview", () => {
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

    expect(screen.getByLabelText("COROS MCP region")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "China" })).toHaveValue("china");
    expect(screen.getByRole("option", { name: "North America or other regions" })).toHaveValue("us");
    expect(screen.getByRole("option", { name: "Europe" })).toHaveValue("eu");
    expect(screen.getByText("Choose the region that matches your COROS account.")).toBeInTheDocument();
    expect(screen.getByText("After opening COROS, sign in with your phone number or email and password.")).toBeInTheDocument();
    expect(screen.getByText("COROS remote MCP login needs MCP OAuth discovery support before this website can open the COROS login page.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Connect COROS" })).not.toBeInTheDocument();
  });

  it("auto-fills the COROS MCP endpoint when the region changes", async () => {
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
            corosRegion: "eu",
            endpoint: "https://mcpeu.coros.com/mcp"
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

    fireEvent.change(screen.getByLabelText("COROS MCP region"), { target: { value: "eu" } });

    expect(screen.getByLabelText("Endpoint for COROS")).toHaveValue("https://mcpeu.coros.com/mcp");
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
    expect(JSON.parse(String(requestInit?.body)).dataMcpConnections[0]).toEqual(
      expect.objectContaining({
        id: "coros",
        corosRegion: "eu",
        endpoint: "https://mcpeu.coros.com/mcp"
      })
    );
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
