import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountSettings } from "@/components/AccountSettings";

describe("AccountSettings", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("shows the real owner identity", () => {
    render(<AccountSettings email="owner@example.com" timezone="Asia/Shanghai" />);
    expect(screen.getByDisplayValue("owner@example.com")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("demo@example.com")).not.toBeInTheDocument();
  });

  it("rejects mismatched passwords before calling the API", () => {
    render(<AccountSettings email="owner@example.com" timezone="Asia/Shanghai" />);
    fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "current-password" } });
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "new-password-123" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "different-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));
    expect(screen.getByRole("alert")).toHaveTextContent("New passwords do not match");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("submits a password change", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ ok: true }) } as Response);
    render(<AccountSettings email="owner@example.com" timezone="Asia/Shanghai" />);
    fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "current-password" } });
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "new-password-123" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "new-password-123" } });
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/v1/account", expect.objectContaining({ method: "PATCH" })));
    expect(await screen.findByRole("status")).toHaveTextContent("Existing sessions were signed out");
  });
});
