export type ActionReversibility = "readonly" | "reversible" | "external_irreversible";

export type AgentActionDefinition = {
  id: string;
  reversibility: ActionReversibility;
  validate: (args: unknown) => Record<string, unknown> | null;
};

const intensities = new Set(["recovery", "easy", "moderate"]);

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export const agentActionRegistry: Record<string, AgentActionDefinition> = {
  explain_plan: {
    id: "explain_plan",
    reversibility: "readonly",
    validate: () => ({})
  },
  recommend_menu: {
    id: "recommend_menu",
    reversibility: "readonly",
    validate: (raw) => {
      const args = (raw ?? {}) as Record<string, unknown>;
      const date = str(args.date);
      const meal = str(args.meal);
      return { ...(date ? { date } : {}), ...(meal ? { meal } : {}) };
    }
  },
  adjust_task_intensity: {
    id: "adjust_task_intensity",
    reversibility: "reversible",
    validate: (raw) => {
      const args = (raw ?? {}) as Record<string, unknown>;
      const taskId = str(args.taskId);
      const intensity = str(args.intensity);
      if (!taskId || !intensity || !intensities.has(intensity)) return null;
      return { taskId, intensity };
    }
  },
  reschedule_task: {
    id: "reschedule_task",
    reversibility: "reversible",
    validate: (raw) => {
      const args = (raw ?? {}) as Record<string, unknown>;
      const taskId = str(args.taskId);
      const newStart = str(args.newStart);
      if (!taskId || !newStart) return null;
      return { taskId, newStart };
    }
  },
  skip_task: {
    id: "skip_task",
    reversibility: "reversible",
    validate: (raw) => {
      const args = (raw ?? {}) as Record<string, unknown>;
      const taskId = str(args.taskId);
      if (!taskId) return null;
      return { taskId, reason: str(args.reason) ?? "Skipped by agent" };
    }
  },
  regenerate_plan: {
    id: "regenerate_plan",
    reversibility: "reversible",
    validate: (raw) => {
      const args = (raw ?? {}) as Record<string, unknown>;
      const weekStart = str(args.weekStart);
      if (!weekStart) return null;
      return { weekStart };
    }
  },
  confirm_calendar_draft: {
    id: "confirm_calendar_draft",
    reversibility: "external_irreversible",
    validate: (raw) => {
      const args = (raw ?? {}) as Record<string, unknown>;
      const draftId = str(args.draftId);
      if (!draftId) return null;
      return { draftId };
    }
  }
};

export function actionIdList() {
  return Object.keys(agentActionRegistry);
}
