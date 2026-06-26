import type { AgentActionProposal } from "@/src/services/agentActions/proposals";

export type GuardSignals = {
  poorSleep: boolean;
  poorRecovery: boolean;
  injury: boolean;
  freeWindows: Array<{ start: string; end: string }>;
  taskCurrentIntensity: string;
};

export type GuardResult = {
  accepted: boolean;
  args: Record<string, unknown>;
  fallbackReason?: string;
};

const order = ["recovery", "easy", "moderate"];

function intensityRank(value: string): number {
  const rank = order.indexOf(value);
  return rank === -1 ? 0 : rank;
}

export function guardAction(action: AgentActionProposal, signals: GuardSignals): GuardResult {
  if (action.id === "adjust_task_intensity") {
    const requested = String(action.args.intensity ?? "");
    const blockUpgrade = signals.poorSleep || signals.poorRecovery || signals.injury;
    const isUpgrade = intensityRank(requested) > intensityRank(signals.taskCurrentIntensity);
    if (blockUpgrade && isUpgrade) {
      return {
        accepted: true,
        args: { ...action.args, intensity: "easy" },
        fallbackReason: "Recovery/sleep/injury signals block an intensity increase; kept at easy."
      };
    }
    return { accepted: true, args: action.args };
  }

  if (action.id === "reschedule_task") {
    const startMs = new Date(String(action.args.newStart)).getTime();
    const inWindow = signals.freeWindows.some(
      (window) => startMs >= new Date(window.start).getTime() && startMs < new Date(window.end).getTime()
    );
    if (!inWindow) {
      return {
        accepted: false,
        args: action.args,
        fallbackReason: "New start is not inside any calendar free window."
      };
    }
    return { accepted: true, args: action.args };
  }

  return { accepted: true, args: action.args };
}
