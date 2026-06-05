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
