import { CalendarCheck2, CheckCircle2, Clock3, HeartPulse, Moon } from "lucide-react";
import { CalendarDraftList } from "@/components/CalendarDraftList";
import { GeneratePlanButton } from "@/components/GeneratePlanButton";
import { MetricCard } from "@/components/MetricCard";
import { NutritionPanel } from "@/components/NutritionPanel";
import { SyncDemoDataButton } from "@/components/SyncDemoDataButton";
import { WeeklyPlan } from "@/components/WeeklyPlan";
import { requireUser } from "@/src/auth/session";
import { prisma } from "@/src/db/client";

function isSameCalendarDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
}

function statusLabel(status: string) {
  if (status === "over_completed") return "completed above plan";
  return status.replace(/_/g, " ");
}

export default async function PlanPage() {
  const user = await requireUser();
  const today = new Date();
  const day = today.getDay() === 0 ? 7 : today.getDay();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - day + 1);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
  const [profile, calendar, plan, activities, primaryGoal, latestSleep, latestRecovery] = await Promise.all([
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
    }),
    prisma.goal.findFirst({
      where: { userId: user.id, status: "active" },
      orderBy: { priority: "desc" }
    }),
    prisma.sleepRecord.findFirst({ where: { userId: user.id }, orderBy: { date: "desc" } }),
    prisma.recoveryRecord.findFirst({ where: { userId: user.id }, orderBy: { date: "desc" } })
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
  const todayTask = plan?.trainingTasks.find((task) => isSameCalendarDay(task.date, today));
  const todayFocus = todayTask
    ? `${todayTask.title} · ${todayTask.durationMinutes} min`
    : plan
      ? "No planned training today"
      : "Generate this week to see today's focus";
  const recoverySignal =
    latestRecovery?.recoveryPercent != null ? `${latestRecovery.recoveryPercent}% recovery` : "Recovery data pending";
  const nextAction = !profile
    ? "Save your body profile"
    : !calendar
      ? "Sync schedule data"
      : plan
        ? "Review and confirm drafts"
        : "Generate this week's plan";

  return (
    <main className="page grid" style={{ gap: 20 }}>
      <div className="page-header">
        <div>
          <span className="eyebrow">
            {weekStart.toLocaleDateString()} – {weekEnd.toLocaleDateString()}
          </span>
          <h1>{primaryGoal ? primaryGoal.title : "This week's rhythm"}</h1>
          <p className="page-subtitle">{plan?.summary ?? "Weekly training, recovery, nutrition, and calendar decisions."}</p>
        </div>
        <div className="toolbar">
          <SyncDemoDataButton />
          <GeneratePlanButton disabled={!readyToGenerate} />
        </div>
      </div>

      <section className="surface today-card" aria-label="Today summary">
        <div className="today-card-main">
          <span className="eyebrow">Today&apos;s plan</span>
          <h2>{todayFocus}</h2>
          <p className="page-subtitle">
            {todayTask
              ? `${statusLabel(todayTask.status)} · ${todayTask.trainingType} · ${todayTask.intensity} intensity`
              : "Complete setup to receive a weekly plan that accounts for recovery, calendar availability, and nutrition."}
          </p>
        </div>
        <div className="today-card-side">
          <div>
            <span>Readiness</span>
            <strong>{recoverySignal}</strong>
          </div>
          <div>
            <span>Next action</span>
            <strong>{nextAction}</strong>
          </div>
        </div>
      </section>

      {!readyToGenerate ? (
        <section className="surface setup-card" aria-label="Setup checklist">
          <div>
            <span className="eyebrow">Setup checklist</span>
            <h2>Finish the inputs before generating a plan.</h2>
            <p className="page-subtitle">The planner needs your body profile and this week&apos;s schedule before it can place training safely.</p>
          </div>
          <div className="setup-steps">
            <div className={profile ? "setup-step setup-step-done" : "setup-step"}>
              <span className="setup-dot" aria-hidden="true">
                {profile ? <CheckCircle2 size={14} /> : null}
              </span>
              <div>
                <strong>Body profile</strong>
                <span>{profile ? "Saved" : "Add height, training context, and preferences"}</span>
              </div>
            </div>
            <div className={calendar ? "setup-step setup-step-done" : "setup-step"}>
              <span className="setup-dot" aria-hidden="true">
                {calendar ? <CheckCircle2 size={14} /> : null}
              </span>
              <div>
                <strong>Schedule data</strong>
                <span>{calendar ? "Synced for this week" : "Sync demo data or connect your calendar"}</span>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid metric-grid metric-grid-plan">
        <MetricCard
          icon={HeartPulse}
          label="Recovery"
          value={latestRecovery?.recoveryPercent != null ? `${latestRecovery.recoveryPercent}%` : "—"}
          hint={latestRecovery ? "Latest readiness signal" : "Sync recovery data"}
          tone="sage"
        />
        <MetricCard
          icon={Moon}
          label="Sleep"
          value={latestSleep ? `${(latestSleep.durationMinutes / 60).toFixed(1)}h` : "—"}
          hint={latestSleep ? "Latest synced duration" : "Sync sleep data"}
          tone="blue"
        />
        <MetricCard
          icon={Clock3}
          label="Planned volume"
          value={plan ? `${plannedMinutes} min` : "—"}
          hint={plan ? `${completedCount}/${plan.trainingTasks.length} sessions updated` : "Generate to calculate"}
          tone="clay"
        />
        <MetricCard
          icon={CalendarCheck2}
          label="Calendar"
          value={plan ? `${confirmedDrafts}/${drafts.length}` : "—"}
          hint={drafts.length > 0 ? "Confirmed training events" : "No drafts yet"}
          tone="neutral"
        />
      </section>

      <section className="plan-content-grid">
        <WeeklyPlan
          plan={plan}
          today={today}
          weekStart={weekStart}
          activities={activities.map((activity) => ({
            id: activity.id,
            label: `${activity.sportType} · ${activity.startedAt.toLocaleDateString()} · ${activity.durationMinutes} min`
          }))}
        />
        <div className="support-stack">
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
