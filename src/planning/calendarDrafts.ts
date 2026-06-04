type ScheduledTask = {
  id: string;
  title: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  trainingType: string;
  intensity: string;
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
    }));
}
