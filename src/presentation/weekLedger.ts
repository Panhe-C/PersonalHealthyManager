export type WeekLedgerTask = {
  id: string;
  date: Date;
  title: string;
  trainingType: string;
  durationMinutes: number;
  intensity: string;
  status: string;
};

export type WeekLedgerDay = {
  date: Date;
  dateKey: string;
  isToday: boolean;
  tasks: WeekLedgerTask[];
};

function startOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function addDays(date: Date, days: number) {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
}

export function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function buildWeekLedger(tasks: WeekLedgerTask[], weekStart: Date, today: Date): WeekLedgerDay[] {
  const taskGroups = new Map<string, WeekLedgerTask[]>();
  const sortedTasks = [...tasks].sort((a, b) => a.date.getTime() - b.date.getTime());

  for (const task of sortedTasks) {
    const key = localDateKey(task.date);
    taskGroups.set(key, [...(taskGroups.get(key) ?? []), task]);
  }

  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(startOfDay(weekStart), index);
    const dateKey = localDateKey(date);
    return {
      date,
      dateKey,
      isToday: dateKey === localDateKey(today),
      tasks: taskGroups.get(dateKey) ?? []
    };
  });
}

export function selectFocusedTaskId(tasks: WeekLedgerTask[], today: Date) {
  if (tasks.length === 0) return null;

  const sortedTasks = [...tasks].sort((a, b) => a.date.getTime() - b.date.getTime());
  const todayKey = localDateKey(today);
  const todayTask = sortedTasks.find((task) => localDateKey(task.date) === todayKey);
  if (todayTask) return todayTask.id;

  const todayStart = startOfDay(today).getTime();
  const upcomingTask = sortedTasks.find((task) => task.date.getTime() >= todayStart);
  return upcomingTask?.id ?? sortedTasks[sortedTasks.length - 1].id;
}
