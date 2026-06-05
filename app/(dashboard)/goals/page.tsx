import { GoalForm } from "@/components/GoalForm";
import { requireUser } from "@/src/auth/session";
import { prisma } from "@/src/db/client";

function typeLabel(type: string) {
  return type.replaceAll("_", " ");
}

export default async function GoalsPage() {
  const user = await requireUser();
  const goals = await prisma.goal.findMany({
    where: { userId: user.id, status: "active" },
    orderBy: { priority: "desc" }
  });

  return (
    <main className="page grid" style={{ gap: 20 }}>
      <div className="page-header">
        <div>
          <span className="eyebrow">Goal priority</span>
          <h1>Goals</h1>
          <p className="page-subtitle">The highest-priority active goal guides the weekly plan.</p>
        </div>
      </div>

      <section className="grid two-column-grid">
        <div className="surface panel">
          <div className="panel-heading">
            <div>
              <h2>Active goals</h2>
              <p className="page-subtitle">Primary and event goals can outrank longer-term goals.</p>
            </div>
          </div>
          {goals.length === 0 ? (
            <div className="empty-state">No active goals yet.</div>
          ) : (
            <div className="list goal-list">
              {goals.map((goal, index) => (
                <div className={index === 0 ? "list-row goal-row-primary" : "list-row"} key={goal.id}>
                  <div>
                    <strong>{goal.title}</strong>
                    <div className="task-meta">
                      {typeLabel(goal.type)}
                      {goal.targetDate ? ` · ${goal.targetDate.toLocaleDateString()}` : ""}
                    </div>
                  </div>
                  <span className={index === 0 ? "status status-positive" : "status"}>Priority {goal.priority}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="panel-heading">
            <div>
              <h2>Add goal</h2>
              <p className="page-subtitle">Use a higher priority for the goal that matters now.</p>
            </div>
          </div>
          <GoalForm />
        </div>
      </section>
    </main>
  );
}
