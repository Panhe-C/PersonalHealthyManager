import { useQuery } from "@tanstack/react-query";
import { api } from "./client";

// M1 probe hooks — exercise the real backend via Bearer to prove end-to-end.
// Fuller feature hooks (today/plan/agent) land in M2/M3.

export function useProfileQuery() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: () => api.get<unknown>("/profile")
  });
}

export function useGoalsQuery() {
  return useQuery({
    queryKey: ["goals"],
    queryFn: () => api.get<unknown[]>("/goals")
  });
}
