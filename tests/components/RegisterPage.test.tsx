import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/(auth)/_components/RegistrationEntry", () => ({
  useRegistrationAvailability: () => true
}));

import RegisterPage from "@/app/(auth)/register/page";

describe("RegisterPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("React", React);
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { href: "" }
    });
  });

  it("registers, signs in, and enters the app without an email-verification step", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ok: true, status: "registered", email: "new@example.com" })
        })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) })
    );

    render(<RegisterPage />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "new@example.com" } });
    fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: "long-enough-password" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "long-enough-password" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "/api/auth/login",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "new@example.com", password: "long-enough-password" })
      })
    );
    expect(window.location.href).toBe("/plan");
    expect(screen.queryByText("Check your inbox")).not.toBeInTheDocument();
  });
});
