"use client";

import React from "react";
import { useState } from "react";
import { DatabaseZap } from "lucide-react";
import { ActionButton } from "@/components/ActionButton";

export function SyncDemoDataButton() {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("Sync could not be completed.");

  async function sync() {
    setState("loading");
    const response = await fetch("/api/sync/coros", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setErrorMessage(typeof body?.error === "string" ? body.error : "Sync could not be completed.");
      setState("error");
      return;
    }

    window.location.reload();
  }

  return (
    <div className="action-stack">
      <ActionButton variant="secondary" type="button" onClick={sync} disabled={state === "loading"}>
        <DatabaseZap aria-hidden="true" size={16} /> {state === "loading" ? "Syncing COROS..." : "Sync COROS data"}
      </ActionButton>
      {state === "error" ? <span className="muted">{errorMessage}</span> : null}
    </div>
  );
}
