import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HealthDisclaimer } from "@/components/HealthDisclaimer";

describe("HealthDisclaimer", () => {
  it("renders the medical disclaimer wording in the footnote variant", () => {
    render(<HealthDisclaimer />);
    expect(
      screen.getByText(/不构成医疗诊断或治疗处方/)
    ).toBeInTheDocument();
  });

  it("renders the same wording in the callout variant", () => {
    render(<HealthDisclaimer variant="callout" />);
    expect(
      screen.getByText(/不构成医疗诊断或治疗处方/)
    ).toBeInTheDocument();
  });
});
