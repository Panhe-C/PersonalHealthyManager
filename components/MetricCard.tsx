import React from "react";
import clsx from "clsx";
import type { LucideIcon } from "lucide-react";

export function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "sage"
}: {
  icon?: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  tone?: "sage" | "blue" | "clay" | "neutral";
}) {
  return (
    <section className={clsx("surface metric-card", `metric-card-${tone}`)}>
      <div className="metric-card-heading">
        {Icon ? <Icon aria-hidden="true" size={16} /> : null}
        <span className="metric-label">{label}</span>
      </div>
      <div className="metric-value">{value}</div>
      {hint ? <div className="metric-hint">{hint}</div> : null}
    </section>
  );
}
