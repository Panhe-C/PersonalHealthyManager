"use client";

import { useState } from "react";
import { DatabaseZap } from "lucide-react";
import { ActionButton } from "@/components/ActionButton";

function isoAt(date: Date, hour: number, minute = 0) {
  const value = new Date(date);
  value.setHours(hour, minute, 0, 0);
  return value.toISOString();
}

function dateOnly(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function SyncDemoDataButton() {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  async function sync() {
    setState("loading");
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const weekEnd = new Date(today);
    weekEnd.setDate(today.getDate() + 7);

    const [corosResponse, calendarResponse] = await Promise.all([
      fetch("/api/sync/coros", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activities: [
            {
              labelId: `demo-run-${dateOnly(yesterday)}`,
              sportType: 100,
              startTime: isoAt(yesterday, 6, 30),
              endTime: isoAt(yesterday, 7, 15),
              distanceKm: 7.2,
              averageHeartRateBpm: 148,
              trainingLoad: 58
            }
          ],
          sleep: [{ date: dateOnly(today), durationMinutes: 455, qualityScore: 84 }],
          recovery: [{ date: dateOnly(today), recoveryPercent: 82, hrvMs: 57, restingHeartRateBpm: 52 }]
        })
      }),
      fetch("/api/sync/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rangeStart: isoAt(today, 0),
          rangeEnd: isoAt(weekEnd, 23, 59),
          busy: [{ start: isoAt(tomorrow, 9), end: isoAt(tomorrow, 17), title: "Work" }],
          free: [{ start: isoAt(tomorrow, 18), end: isoAt(tomorrow, 19), title: "Training window" }]
        })
      })
    ]);

    if (!corosResponse.ok || !calendarResponse.ok) {
      setState("error");
      return;
    }

    window.location.reload();
  }

  return (
    <div className="grid" style={{ gap: 6 }}>
      <ActionButton variant="secondary" type="button" onClick={sync} disabled={state === "loading"}>
        <DatabaseZap aria-hidden="true" size={16} /> {state === "loading" ? "Syncing..." : "Sync demo data"}
      </ActionButton>
      {state === "error" ? <span className="muted">Sync could not be completed.</span> : null}
    </div>
  );
}
