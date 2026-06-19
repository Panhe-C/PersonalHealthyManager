import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SyncDemoDataButton } from "@/components/SyncDemoDataButton";

describe("SyncDemoDataButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));
  });

  it("starts a Settings-backed COROS sync without sending demo health data", async () => {
    render(<SyncDemoDataButton />);

    expect(screen.getByRole("button", { name: "Sync COROS data" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sync COROS data" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/sync/coros",
        expect.objectContaining({
          method: "POST",
          body: "{}"
        })
      );
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body))).toEqual({});
    expect(screen.getByRole("button", { name: "Syncing COROS..." })).toBeDisabled();
  });
});
