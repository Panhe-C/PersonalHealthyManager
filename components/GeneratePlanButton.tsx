"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { ActionButton } from "@/components/ActionButton";

function mondayForCurrentWeek() {
  const today = new Date();
  const day = today.getDay() === 0 ? 7 : today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - day + 1);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export function GeneratePlanButton({ disabled = false }: { disabled?: boolean }) {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  async function generate() {
    setState("loading");
    const response = await fetch("/api/plan/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weekStart: mondayForCurrentWeek().toISOString() })
    });

    if (!response.ok) {
      setState("error");
      return;
    }

    window.location.reload();
  }

  return (
    <div className="action-stack">
      <ActionButton type="button" onClick={generate} disabled={disabled || state === "loading"}>
        <RefreshCw aria-hidden="true" size={16} /> {state === "loading" ? "Generating..." : "Generate this week"}
      </ActionButton>
      {state === "error" ? <span className="muted">Plan could not be generated.</span> : null}
    </div>
  );
}
