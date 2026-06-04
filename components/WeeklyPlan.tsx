import { Checklist } from "@/components/Checklist";

type WeeklyPlanProps = {
  plan: {
    summary: string;
    explanation: string;
    trainingTasks: Array<{
      id: string;
      date: Date;
      title: string;
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

export function WeeklyPlan({ plan }: WeeklyPlanProps) {
  if (!plan) {
    return <section className="surface empty-state">Generate a plan after saving a profile and syncing schedule data.</section>;
  }

  return (
    <section className="surface panel">
      <div className="panel-heading">
        <div>
          <h2>{plan.summary}</h2>
          <p className="page-subtitle">{plan.explanation}</p>
        </div>
      </div>

      <div className="task-list">
        {plan.trainingTasks.map((task) => (
          <article className="task-row" key={task.id}>
            <div className="task-heading">
              <div>
                <h3 style={{ marginBottom: 5 }}>{task.title}</h3>
                <div className="task-meta">
                  {task.date.toLocaleDateString()} · {task.durationMinutes} min · {task.intensity}
                  {task.scheduledStart ? ` · ${task.scheduledStart.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
                </div>
              </div>
              <span className={taskStatusClass(task.status)}>{task.status.replace("_", " ")}</span>
            </div>
            <Checklist taskId={task.id} items={task.checklistItems} />
          </article>
        ))}
      </div>
    </section>
  );
}
