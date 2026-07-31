import { z } from "zod";
import { api } from "./client";

const corosSyncResultSchema = z.object({
  activities: z.number(),
  sleep: z.number(),
  recovery: z.number()
});

export type CorosSyncResult = z.infer<typeof corosSyncResultSchema>;

/** Pull recent COROS activity / sleep / recovery into the user's vault. */
export function syncCoros(options?: { days?: number }) {
  return api.post<CorosSyncResult>(
    "/sync/coros",
    options?.days === undefined ? {} : { days: options.days },
    corosSyncResultSchema
  );
}
