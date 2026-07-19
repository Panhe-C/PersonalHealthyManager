import { goalListResponseSchema, goalSchema, type Goal } from "./schemas";
import { api } from "./client";

export type GoalInput = { title: string; type: Goal["type"]; priority: number; status: Goal["status"]; targetDate?: string; metrics: Record<string, unknown> };
export function getGoals() { return api.get<Goal[]>("/goals", goalListResponseSchema); }
export function createGoal(input: GoalInput) { return api.post<Goal>("/goals", input, goalSchema); }
export function updateGoal(id: string, input: GoalInput) { return api.patch<Goal>(`/goals/${id}`, input, goalSchema); }
export function pauseGoal(id: string) { return api.delete<{ ok: true }>(`/goals/${id}`); }
