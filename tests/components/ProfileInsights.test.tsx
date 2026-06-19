import React from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProfileInsights } from "@/components/ProfileInsights";

describe("ProfileInsights", () => {
  it("renders a varied recovery, sleep, and load dashboard", () => {
    render(
      <ProfileInsights
        activities={[
          {
            id: "activity-1",
            sportType: "run",
            startedAt: new Date(2026, 5, 16, 7),
            durationMinutes: 42,
            distanceKm: 8.2,
            averageHeartRateBpm: 148,
            trainingLoad: 86,
            intensity: "moderate"
          }
        ]}
        sleepRecords={[
          { id: "sleep-1", date: new Date(2026, 5, 15), durationMinutes: 450, qualityScore: 82 },
          { id: "sleep-2", date: new Date(2026, 5, 16), durationMinutes: 390, qualityScore: 74 }
        ]}
        recoveryRecords={[
          {
            id: "recovery-1",
            date: new Date(2026, 5, 15),
            recoveryPercent: 78,
            hrvMs: 56,
            restingHeartRateBpm: 52,
            trainingLoadShortTerm: 248,
            trainingLoadLongTerm: 312
          },
          {
            id: "recovery-2",
            date: new Date(2026, 5, 16),
            recoveryPercent: 64,
            hrvMs: 49,
            restingHeartRateBpm: 55,
            trainingLoadShortTerm: 270,
            trainingLoadLongTerm: 320
          }
        ]}
      />
    );

    expect(screen.getByRole("heading", { name: "Health trends" })).toBeInTheDocument();
    expect(screen.getByText("Readiness dial")).toBeInTheDocument();
    expect(screen.getByText("Sleep runway")).toBeInTheDocument();
    expect(screen.getByText("Load mosaic")).toBeInTheDocument();
    expect(screen.getByText("Latest session")).toBeInTheDocument();
    expect(screen.getByText("8.2 km")).toBeInTheDocument();
    expect(screen.getByText("148 bpm")).toBeInTheDocument();

    const sleepRunway = screen.getByLabelText("Recent sleep runway");
    expect(within(sleepRunway).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByLabelText("Readiness dial")).toHaveTextContent("64%");
  });

  it("shows an empty state when no synced health data is available", () => {
    render(<ProfileInsights activities={[]} sleepRecords={[]} recoveryRecords={[]} />);

    expect(screen.getByRole("heading", { name: "Health trends" })).toBeInTheDocument();
    expect(screen.getByText("Sync COROS data to unlock trend charts.")).toBeInTheDocument();
  });
});
