import { z } from "zod";
import { api } from "./client";

export const automationStateSchema = z.object({
  id: z.string(),
  kind: z.string(),
  status: z.string(),
  lastStartedAt: z.string().nullable(),
  lastCompletedAt: z.string().nullable(),
  lastSuccessAt: z.string().nullable(),
  lastError: z.string().nullable()
}).passthrough();

export function getAutomationStates() {
  return api.get<z.infer<typeof automationStateSchema>[]>("/automation/status", z.array(automationStateSchema));
}
