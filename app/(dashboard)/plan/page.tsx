import { CalendarDraftList } from "@/components/CalendarDraftList";
import { GeneratePlanButton } from "@/components/GeneratePlanButton";
import { MetricCard } from "@/components/MetricCard";
import { NutritionPanel } from "@/components/NutritionPanel";
import { SyncDemoDataButton } from "@/components/SyncDemoDataButton";
import { WeeklyPlan } from "@/components/WeeklyPlan";
import { requireUser } from "@/src/auth/session";
import { prisma } from "@/src/db/client";

export default async function PlanPage() {
  const user = await requireUser();
  const today = new Date();
  const day = today.getDay() === 0 ? 7 : today.getDay();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - day + 1);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
  const [profile, calendar, plan, activities] = await Promise.all([
    prisma.bodyProfile.findUnique({ where: { userId: user.id } }),
    prisma.calendarSnapshot.findFirst({
      where: {
        userId: user.id,
        rangeStart: { lte: weekStart },
        rangeEnd: { gte: weekEnd }
      },
      orderBy: { capturedAt: "desc" }
    }),
    prisma.plan.findFirst({
      where: { userId: user.id, status: { not: "superseded" } },
      orderBy: { createdAt: "desc" },
      include: {
        trainingTasks: {
          orderBy: { date: "asc" },
          include: { checklistItems: { orderBy: { order: "asc" } } }
        }
      }
    }),
    prisma.activityRecord.findMany({
      where: { userId: user.id },
      orderBy: { startedAt: "desc" },
      take: 10
    })
  ]);
  const drafts = plan
    ? await prisma.calendarEventDraft.findMany({
        where: { userId: user.id, planId: plan.id },
        orderBy: { startsAt: "asc" }
      })
    : [];
  const nutrition = plan ? JSON.parse(plan.nutritionTargetsJson) : null;
  const completedCount = plan?.trainingTasks.filter((task) => task.status !== "planned").length ?? 0;
  const plannedMinutes = plan?.trainingTasks.reduce((total, task) => total + task.durationMinutes, 0) ?? 0;
  const confirmedDrafts = drafts.filter((draft) => draft.status === "confirmed").length;
  const readyToGenerate = Boolean(profile && calendar);

  return (
    <main className="page grid" style={{ gap: 20 }}>
      <div className="page-header">
        <div>
          <h1>Plan</h1>
          <p className="page-subtitle">Weekly training, daily checklist, nutrition targets, and calendar confirmation.</p>
        </div>
        <div className="toolbar">
          <SyncDemoDataButton />
          <GeneratePlanButton disabled={!readyToGenerate} />
        </div>
      </div>

      {!readyToGenerate ? (
        <div className="message message-error">
          Save a body profile and sync schedule data before generating a plan.
        </div>
      ) : null}

      <section className="grid metric-grid">
        <MetricCard label="Weekly sessions" value={plan ? String(plan.trainingTasks.length) : "—"} hint={`${completedCount} updated`} />
        <MetricCard label="Planned volume" value={plan ? `${plannedMinutes} min` : "—"} hint="Adjusts with checklist feedback" />
        <MetricCard label="Calendar status" value={`${confirmedDrafts}/${drafts.length}`} hint="Confirmed training events" />
      </section>

      <section className="grid two-column-grid">
        <WeeklyPlan
          plan={plan}
          activities={activities.map((activity) => ({
            id: activity.id,
            label: `${activity.sportType} · ${activity.startedAt.toLocaleDateString()} · ${activity.durationMinutes} min`
          }))}
        />
        <div className="grid">
          <NutritionPanel nutrition={nutrition} />
          <CalendarDraftList
            drafts={drafts.map((draft) => ({
              id: draft.id,
              title: draft.title,
              startsAt: draft.startsAt.toISOString(),
              endsAt: draft.endsAt.toISOString(),
              operation: draft.operation,
              status: draft.status
            }))}
          />
        </div>
      </section>
    </main>
  );
}
