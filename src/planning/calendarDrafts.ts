type ScheduledTask = {
  id: string;
  title: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  trainingType: string;
  intensity: string;
};

export type CalendarDraftInput = {
  trainingTaskId: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  notes: string;
  externalEventId?: string;
};

export function createCalendarDraftsFromTasks(tasks: ScheduledTask[]) {
  return tasks
    .filter((task) => task.scheduledStart && task.scheduledEnd)
    .map((task) => ({
      trainingTaskId: task.id,
      title: `Training: ${task.title}`,
      startsAt: new Date(task.scheduledStart as string),
      endsAt: new Date(task.scheduledEnd as string),
      notes: `Type: ${task.trainingType}. Intensity: ${task.intensity}.`
    }))
    .sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime());
}

export function carryForwardExternalEventIds(
  drafts: CalendarDraftInput[],
  externalEventIds: string[]
): CalendarDraftInput[] {
  return drafts.map((draft, index) => {
    const externalEventId = externalEventIds[index];
    return externalEventId ? { ...draft, externalEventId } : draft;
  });
}
