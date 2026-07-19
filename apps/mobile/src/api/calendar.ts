import { z } from "zod";
import { api } from "./client";

export const calendarDraftSchema = z.object({
  id: z.string(), title: z.string(), startsAt: z.string(), endsAt: z.string(), notes: z.string(), operation: z.string(),
  status: z.string(), externalEventId: z.string().nullable(), failureReason: z.string().nullable()
}).passthrough();
export type MobileCalendarDraft = z.infer<typeof calendarDraftSchema>;
export function getCalendarDrafts() { return api.get<MobileCalendarDraft[]>("/calendar/drafts", z.array(calendarDraftSchema)); }
export function confirmCalendarDraft(id: string) { return api.post<MobileCalendarDraft>(`/calendar/drafts/${id}/confirm`, undefined, calendarDraftSchema); }
