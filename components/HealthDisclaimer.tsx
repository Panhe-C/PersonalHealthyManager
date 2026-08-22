import React from "react";
import { ShieldAlert } from "lucide-react";

/**
 * The standing health disclaimer. Used as a footnote under the plan and under
 * each coach reply, and as the body of the one-time acknowledgment modal. The
 * wording is the same in all three places so a user who has seen it once is not
 * surprised by a different claim later.
 */
export function HealthDisclaimer({ variant = "footnote" }: { variant?: "footnote" | "callout" }) {
  return (
    <p className={variant === "callout" ? "disclaimer-callout" : "disclaimer-footnote"}>
      <ShieldAlert aria-hidden="true" size={14} />
      <span>
        健康身体管家提供训练与恢复建议，但<b>不构成医疗诊断或治疗处方</b>。如有伤病、慢性病或服药情况，请以医生意见为准。
      </span>
    </p>
  );
}
