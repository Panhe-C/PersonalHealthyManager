"use client";

import { LogOut } from "lucide-react";

export function LogoutButton() {
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <button aria-label="Sign out" className="icon-button" title="Sign out" type="button" onClick={logout}>
      <LogOut aria-hidden="true" size={16} />
    </button>
  );
}
