import React from "react";
import { render, screen } from "@testing-library/react";
import { HeartPulse } from "lucide-react";
import { describe, expect, it } from "vitest";
import { MetricCard } from "@/components/MetricCard";

describe("MetricCard", () => {
  it("renders an icon and semantic tone class", () => {
    render(<MetricCard icon={HeartPulse} label="Recovery" value="82%" tone="sage" />);

    expect(screen.getByText("Recovery").closest("section")).toHaveClass("metric-card-sage");
    expect(screen.getByText("Recovery").closest("section")?.querySelector("svg")).toBeTruthy();
  });
});
