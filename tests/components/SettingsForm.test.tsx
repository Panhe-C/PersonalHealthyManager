import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsForm } from "@/components/SettingsForm";
import { defaultDataMcpConnections } from "@/src/settings/defaults";

describe("SettingsForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
          body: JSON.stringify({ target: "all" })
        })
      );
    });
    expect(await screen.findByText("Model responded.")).toBeInTheDocument();
  });
});
