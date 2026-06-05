import React from "react";
import { Checklist } from "@/components/Checklist";
import { WeekLedger } from "@/components/WeekLedger";
import { selectFocusedTaskId } from "@/src/presentation/weekLedger";

type WeeklyPlanProps = {
  activities: Array<{ id: string; label: string }>;
  today: Date;
  weekStart: Date;
  plan: {
    summary: string;
    explanation: string;
    trainingTasks: Array<{
      id: string;
      date: Date;
      title: string;
      trainingType: string;
      status: string;
      intensity: string;
      durationMinutes: number;
      scheduledStart: Date | null;
      checklistItems: Array<{ id: string; label: string; status: string }>;
    }>;
  } | null;
};

function taskStatusClass(status: string) {
  if (status === "completed" || status === "over_completed") return "status status-positive";
  if (status === "partial" || status === "skipped") return "status status-warn";
  return "status status-info";
}

export function WeeklyPlan({ plan, activities, today, weekStart }: WeeklyPlanProps) {
  if (!plan) {
    return <section className="surface empty-state">Generate a plan after saving a profile and syncing schedule data.</section>;
  }

  const focusedTaskId = selectFocusedTaskId(plan.trainingTasks, today);

  return (
    <section className="training-journal">
      <div className="journal-heading">
        <div>
          <span className="eyebrow">Weekly rhythm</span>
          <h2>{plan.summary}</h2>
          <p className="page-subtitle">{plan.explanation}</p>
        </div>
      </div>

      <WeekLedger tasks={plan.trainingTasks} today={today} weekStart={weekStart} />

      <div className="training-details">
        {plan.trainingTasks.map((task) => (
          <details className="training-detail surface" id={`task-${task.id}`} key={task.id} open={task.id === focusedTaskId}>
            <summary className="training-detail-summary">
              <span>
                <strong>{task.title}</strong>
                <span className="task-meta">
                  {task.date.toLocaleDateString()} · {task.durationMinutes} min · {task.intensity}
                  {task.scheduledStart ? ` · ${task.scheduledStart.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
                </span>
              </span>
              <span className={taskStatusClass(task.status)}>{task.status.replace("_", " ")}</span>
            </summary>
            <Checklist taskId={task.id} items={task.checklistItems} activities={activities} readOnly={task.status !== "planned"} />
          </details>
        ))}
      </div>
    </section>
  );
}
