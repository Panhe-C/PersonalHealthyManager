import { api } from "./client";
import {
  activePlanSchema,
  completedTrainingTaskSchema,
  type ActivePlan,
  type CompletedTrainingTask,
  type TrainingCompletionRequest
} from "./schemas";

export function completeTrainingTask(taskId: string, completion: TrainingCompletionRequest) {
  return api.post<CompletedTrainingTask>(`/training/tasks/${taskId}/completion`, completion, completedTrainingTaskSchema);
}

export function generateActivePlan(weekStart: string) {
  return api.post<ActivePlan>("/plan/generate", { weekStart }, activePlanSchema);
}
