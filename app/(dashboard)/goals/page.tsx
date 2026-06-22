import { GoalForm } from "@/components/GoalForm";
import { GoalList } from "@/components/GoalList";
import { requireUser } from "@/src/auth/session";
import { prisma } from "@/src/db/client";

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
          <GoalList
            goals={goals.map((goal) => ({
              id: goal.id,
              title: goal.title,
              type: goal.type,
              priority: goal.priority,
              targetDate: goal.targetDate ? goal.targetDate.toISOString().slice(0, 10) : null,
              targetDateLabel: goal.targetDate ? goal.targetDate.toLocaleDateString() : null
            }))}
          />
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
