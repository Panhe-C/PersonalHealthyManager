type ScheduledTask = {
  id: string;
  title: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  trainingType: string;
  intensity: string;
};

export type CalendarDraftInput = {
  trainingTaskId?: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  notes: string;
  operation: "upsert" | "cancel";
  externalEventId?: string;
};

export type ExistingCalendarEvent = {
  externalEventId: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  notes: string;
};

export function createCalendarDraftsFromTasks(tasks: ScheduledTask[]) {
  return tasks
    .filter((task) => task.scheduledStart && task.scheduledEnd)
    .map((task) => ({
      trainingTaskId: task.id,
      title: `Training: ${task.title}`,
      startsAt: new Date(task.scheduledStart as string),
      endsAt: new Date(task.scheduledEnd as string),
      notes: `Type: ${task.trainingType}. Intensity: ${task.intensity}.`,
      operation: "upsert" as const
    }))
    .sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime());
}

export function reconcileCalendarDrafts(
  drafts: CalendarDraftInput[],
  existingEvents: ExistingCalendarEvent[]
): CalendarDraftInput[] {
  const sortedDrafts = [...drafts].sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime());
  const sortedEvents = [...existingEvents].sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime());
  const replacements = sortedDrafts.map((draft, index) => {
    const existingEvent = sortedEvents[index];
    return existingEvent ? { ...draft, externalEventId: existingEvent.externalEventId } : draft;
  });
  const cancellations: CalendarDraftInput[] = sortedEvents.slice(sortedDrafts.length).map((event) => ({
    title: event.title.startsWith("Cancel: ") ? event.title : `Cancel: ${event.title}`,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    notes: "Remove this training event because it is not part of the latest weekly plan.",
    operation: "cancel",
    externalEventId: event.externalEventId
  }));

  return [...replacements, ...cancellations];
}
