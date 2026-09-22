import { describe, expect, it, vi } from "vitest";
import {
  clampCorosSyncDays,
  COROS_SYNC_LOOKBACK_DAYS,
  recentCorosSyncWindow
} from "@/src/providers/coros-mcp";

describe("COROS sync window", () => {
  it("defaults to the full lookback and clamps short pull-to-refresh windows", () => {
    expect(clampCorosSyncDays(undefined)).toBe(COROS_SYNC_LOOKBACK_DAYS);
    expect(clampCorosSyncDays(2)).toBe(2);
    expect(clampCorosSyncDays(0)).toBe(1);
    expect(clampCorosSyncDays(99)).toBe(30);
  });

  it("builds a compact Asia/Shanghai date range for the requested days", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-20T12:00:00+08:00"));

    expect(recentCorosSyncWindow()).toEqual({
      days: 14,
      startDate: "20260607",
      endDate: "20260620"
    });
    expect(recentCorosSyncWindow(new Date(), 2)).toEqual({
      days: 2,
      startDate: "20260619",
      endDate: "20260620"
    });

    vi.useRealTimers();
  });
});
