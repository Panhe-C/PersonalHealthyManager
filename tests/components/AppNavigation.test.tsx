import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppNavigation } from "@/components/AppNavigation";

const usePathname = vi.fn();

vi.mock("next/navigation", () => ({ usePathname: () => usePathname() }));
vi.mock("@/components/LogoutButton", () => ({
  LogoutButton: () => <button aria-label="Sign out" type="button" />
}));

describe("AppNavigation", () => {
  beforeEach(() => usePathname.mockReturnValue("/settings"));

  it("marks the current route and leaves other links inactive", () => {
    render(<AppNavigation />);

    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Plan" })).not.toHaveAttribute("aria-current");
  });
});
