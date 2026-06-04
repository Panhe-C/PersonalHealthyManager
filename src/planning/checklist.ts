import type { TrainingStatus } from "@/src/domain/models";

type ChecklistInput = {
  plannedLoad: number;
  actualLoad?: number;
  items: Array<{
    label: string;
    status: "pending" | "completed" | "skipped";
  }>;
};

type ChecklistResult = {
  status: TrainingStatus;
  remainingLoadAdjustment: number;
  adjustmentReason: string;
};

export function reconcileChecklistCompletion(input: ChecklistInput): ChecklistResult {
  const completed = input.items.filter((item) => item.status === "completed").length;
  const skipped = input.items.filter((item) => item.status === "skipped").length;
  const completionRatio = input.items.length > 0 ? completed / input.items.length : 0;
  const actualLoad = input.actualLoad ?? Math.round(input.plannedLoad * completionRatio);

  if (input.items.length > 0 && skipped === input.items.length) {
    return {
      status: "skipped",
      remainingLoadAdjustment: input.plannedLoad,
      adjustmentReason: "Training was skipped; attempt to reschedule or downgrade later sessions based on recovery and calendar windows."
    };
  }

  if (actualLoad > input.plannedLoad * 1.25) {
    return {
      status: "over_completed",
      remainingLoadAdjustment: input.plannedLoad - actualLoad,
      adjustmentReason: "Actual load exceeded planned load; reduce remaining weekly intensity."
    };
  }

  if (input.items.length > 0 && completed === input.items.length) {
    return {
      status: "completed",
      remainingLoadAdjustment: 0,
      adjustmentReason: "Training completed as planned."
    };
  }

  return {
    status: "partial",
    remainingLoadAdjustment: input.plannedLoad - actualLoad,
    adjustmentReason: "Training was partially completed; adjust remaining weekly work conservatively."
  };
}
