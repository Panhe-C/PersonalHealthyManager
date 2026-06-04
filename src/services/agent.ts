export type AgentIntent = "recovery_check" | "calendar_confirmation" | "menu_advice" | "replan" | "general";

export function createAgentResponse(message: string): { intent: AgentIntent; message: string } {
  if (/睡|sleep|恢复|recovery/i.test(message)) {
    return {
      intent: "recovery_check",
      message:
        "I will check sleep and recovery first. If recovery is low, the plan should downgrade hard training to recovery work."
    };
  }

  if (/日历|calendar|写入|飞书/i.test(message)) {
    return {
      intent: "calendar_confirmation",
      message:
        "I can prepare the training calendar drafts for review. Nothing is written until you confirm the drafts."
    };
  }

  if (/午餐|早餐|晚餐|menu|吃/i.test(message)) {
    return {
      intent: "menu_advice",
      message: "I will compare today's menu with the training intensity and nutrition targets."
    };
  }

  if (/重新|调整|replan|改/i.test(message)) {
    return {
      intent: "replan",
      message: "I can re-run the planning rules with the latest schedule, recovery, and completion data."
    };
  }

  return {
    intent: "general",
    message: "Ask me about today's training, menu choices, recovery, or calendar confirmation."
  };
}
