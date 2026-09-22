export type ReminderTask = { id: string; title: string; scheduledStart: string | null; status: string };

export function upcomingReminderTasks(tasks: ReminderTask[], now = new Date()) {
  const horizon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  return tasks.filter((task) => {
    if (!task.scheduledStart || task.status === "completed" || task.status === "skipped") return false;
    const startsAt = new Date(task.scheduledStart);
    return startsAt.getTime() - 30 * 60 * 1000 > now.getTime() && startsAt <= horizon;
  });
}
