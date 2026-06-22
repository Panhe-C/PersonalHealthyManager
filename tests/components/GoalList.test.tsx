import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GoalList } from "@/components/GoalList";

const goals = [
  {
    id: "goal-1",
    title: "Marathon",
    type: "primary",
    priority: 9,
    targetDate: "2026-10-18",
    targetDateLabel: "10/18/2026"
  },
  {
    id: "goal-2",
    title: "Sleep better",
    type: "long_term",
    priority: 6,
    targetDate: null,
    targetDateLabel: null
  }
];

describe("GoalList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    Object.defineProperty(window, "location", {
      value: { reload: vi.fn() },
      writable: true
    });
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));
  });

  it("updates an existing goal from the inline editor", async () => {
    render(<GoalList goals={goals} />);

    fireEvent.click(screen.getByRole("button", { name: "Edit Marathon" }));
    fireEvent.change(screen.getByLabelText("Goal title"), { target: { value: "Half marathon" } });
    fireEvent.change(screen.getByLabelText("Priority"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/goals/goal-1",
        expect.objectContaining({
          method: "PATCH"
        })
      );
    });

    const [, requestInit] = vi.mocked(fetch).mock.calls.at(0) ?? [];
    expect(JSON.parse(String(requestInit?.body))).toEqual({
      title: "Half marathon",
      type: "primary",
      priority: 10,
      status: "active",
      targetDate: "2026-10-18",
      metrics: {}
    });
    expect(window.location.reload).toHaveBeenCalled();
  });

  it("removes an active goal after confirmation", async () => {
    render(<GoalList goals={goals} />);

    const row = screen.getByText("Sleep better").closest(".list-row");
    expect(row).not.toBeNull();
    fireEvent.click(within(row as HTMLElement).getByRole("button", { name: "Remove Sleep better" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/goals/goal-2",
        expect.objectContaining({
          method: "DELETE"
        })
      );
    });
    expect(window.confirm).toHaveBeenCalledWith('Remove "Sleep better" from active goals?');
    expect(window.location.reload).toHaveBeenCalled();
  });
});
