import { useQuery } from "@tanstack/react-query";
import { getAgentConversation, listAgentConversations, listAgentMemories } from "./agent";
import {
  activePlanResponseSchema,
  activitiesResponseSchema,
  goalListResponseSchema,
  recoveryResponseSchema,
  sleepResponseSchema,
  todayOverviewSchema,
  type ActivityRecord,
  type ActivePlan,
  type Conversation,
  type Goal,
  type RecoveryRecord,
  type SleepRecord,
  type TodayOverview
} from "./schemas";
import { api } from "./client";
import { getAccount } from "./account";
import { getSettings } from "./settings";

export function useAccountQuery() {
  return useQuery({ queryKey: ["account"], queryFn: getAccount });
}

export function useSettingsQuery() {
  return useQuery({ queryKey: ["settings"], queryFn: getSettings });
}

export function useProfileQuery() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: () => api.get<unknown>("/profile")
  });
}

export function useGoalsQuery() {
  return useQuery({
    queryKey: ["goals"],
    queryFn: () => api.get<Goal[]>("/goals", goalListResponseSchema)
  });
}

export function useTodayOverviewQuery() {
  return useQuery({
    queryKey: ["today"],
    queryFn: () => api.get<TodayOverview>("/today", todayOverviewSchema)
  });
}

export function useActivePlanQuery() {
  return useQuery({
    queryKey: ["plan", "active"],
    queryFn: () => api.get<ActivePlan | null>("/plan/active", activePlanResponseSchema)
  });
}

export function useActivitiesQuery(limit = 10) {
  return useQuery({
    queryKey: ["insights", "activities", limit],
    queryFn: () => api.get<ActivityRecord[]>(`/insights/activities?limit=${limit}`, activitiesResponseSchema)
  });
}

export function useSleepQuery(limit = 10) {
  return useQuery({
    queryKey: ["insights", "sleep", limit],
    queryFn: () => api.get<SleepRecord[]>(`/insights/sleep?limit=${limit}`, sleepResponseSchema)
  });
}

export function useRecoveryQuery(limit = 10) {
  return useQuery({
    queryKey: ["insights", "recovery", limit],
    queryFn: () => api.get<RecoveryRecord[]>(`/insights/recovery?limit=${limit}`, recoveryResponseSchema)
  });
}

export function useConversationsQuery() {
  return useQuery({
    queryKey: ["agent", "conversations"],
    queryFn: listAgentConversations
  });
}

export function useConversationDetailQuery(conversationId?: string) {
  return useQuery({
    enabled: Boolean(conversationId),
    queryKey: ["agent", "conversations", conversationId],
    queryFn: () => getAgentConversation(conversationId ?? "")
  });
}

export function useAgentMemoriesQuery() {
  return useQuery({
    queryKey: ["agent", "memories"],
    queryFn: listAgentMemories
  });
}
