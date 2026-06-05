import React from "react";
import clsx from "clsx";
import { Clock3 } from "lucide-react";
import { buildWeekLedger, type WeekLedgerTask } from "@/src/presentation/weekLedger";

function statusClass(status: string) {
  if (status === "completed" || status === "over_completed") return "ledger-task ledger-task-positive";
  if (status === "partial" || status === "skipped") return "ledger-task ledger-task-warn";
  return "ledger-task";
}

export function WeekLedger({
  tasks,
  today,
  weekStart
}: {
  tasks: WeekLedgerTask[];
  today: Date;
  weekStart: Date;
}) {
  const days = buildWeekLedger(tasks, weekStart, today);

  return (
    <div className="week-ledger-scroll">
      <div className="week-ledger" aria-label="Week ledger">
        {days.map((day) => (
          <article className={clsx("ledger-day", day.isToday && "ledger-day-today")} key={day.dateKey}>
            <div className="ledger-day-heading">
              <span>{day.date.toLocaleDateString([], { weekday: "short" })}</span>
              <strong>{day.date.getDate()}</strong>
            </div>
            <div className="ledger-task-list">
              {day.tasks.length === 0 ? (
                <span className="ledger-rest">Rest / open</span>
              ) : (
                day.tasks.map((task) => (
                  <a className={statusClass(task.status)} href={`#task-${task.id}`} key={task.id}>
                    <strong>{task.title}</strong>
                    <span>
                      <Clock3 aria-hidden="true" size={12} /> {task.durationMinutes} min
                    </span>
                  </a>
                ))
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
