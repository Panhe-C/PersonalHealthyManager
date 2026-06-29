import React from "react";
import { CalendarCheck2, CheckCircle2, Clock3, HeartPulse, Moon } from "lucide-react";
import { CalendarDraftList } from "@/components/CalendarDraftList";
import { GeneratePlanButton } from "@/components/GeneratePlanButton";
import { MetricCard } from "@/components/MetricCard";
import { NutritionPanel } from "@/components/NutritionPanel";
import { SyncDemoDataButton } from "@/components/SyncDemoDataButton";
import { WeeklyPlan } from "@/components/WeeklyPlan";
import {
  getActivePlan,
  getActivePlanSummary,
  getBodyProfile,
  getCalendarSnapshot,
  getDraftsForPlan,
  getLatestRecovery,
  getLatestSleep,
  getPrimaryGoal,
  getRecentActivities
} from "./_data";

function isSameCalendarDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function statusLabel(status: string) {
  if (status === "over_completed") return "completed above plan";
  return status.replace(/_/g, " ");
}

export async function PlanHeader({ userId, weekStart, weekEnd }: { userId: string; weekStart: Date; weekEnd: Date }) {
  const [primaryGoal, planSummary, profile, calendar] = await Promise.all([
    getPrimaryGoal(userId),
    getActivePlanSummary(userId),
    getBodyProfile(userId),
    getCalendarSnapshot(userId, weekStart, weekEnd)
  ]);
  const readyToGenerate = Boolean(profile && calendar);

  return (
    <div className="page-header">
      <div>
        <span className="eyebrow">
          {weekStart.toLocaleDateString()} – {weekEnd.toLocaleDateString()}
        </span>
        <h1>{primaryGoal ? primaryGoal.title : "This week's rhythm"}</h1>
        <p className="page-subtitle">
          {planSummary?.summary ?? "Weekly training, recovery, nutrition, and calendar decisions."}
        </p>
      </div>
      <div className="toolbar">
        <SyncDemoDataButton />
        <GeneratePlanButton disabled={!readyToGenerate} />
      </div>
    </div>
  );
}

export async function TodaySummary({ userId, today }: { userId: string; today: Date }) {
  const [plan, latestRecovery] = await Promise.all([getActivePlan(userId), getLatestRecovery(userId)]);
  const todayTask = plan?.trainingTasks.find((task) => isSameCalendarDay(task.date, today)) ?? null;
  const todayFocus = todayTask
    ? `${todayTask.title} · ${todayTask.durationMinutes} min`
    : plan
      ? "No planned training today"
      : "Generate this week to see today's focus";
  const recoverySignal =
    latestRecovery?.recoveryPercent != null ? `${latestRecovery.recoveryPercent}% recovery` : "Recovery data pending";

  return (
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
          <strong>{plan ? "Review and confirm drafts" : "Generate this week's plan"}</strong>
        </div>
      </div>
    </section>
  );
}

export async function SetupChecklist({ userId, weekStart, weekEnd }: { userId: string; weekStart: Date; weekEnd: Date }) {
  const [profile, calendar] = await Promise.all([
    getBodyProfile(userId),
    getCalendarSnapshot(userId, weekStart, weekEnd)
  ]);
  if (profile && calendar) return null;

  return (
    <section className="surface setup-card" aria-label="Setup checklist">
      <div>
        <span className="eyebrow">Setup checklist</span>
        <h2>Finish the inputs before generating a plan.</h2>
        <p className="page-subtitle">
          The planner needs your body profile and this week&apos;s schedule before it can place training safely.
        </p>
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
  );
}

export async function PlanMetrics({ userId }: { userId: string }) {
  const plan = await getActivePlan(userId);
  const [latestRecovery, latestSleep, drafts] = await Promise.all([
    getLatestRecovery(userId),
    getLatestSleep(userId),
    getDraftsForPlan(userId, plan?.id ?? null)
  ]);
  const completedCount = plan?.trainingTasks.filter((task) => task.status !== "planned").length ?? 0;
  const plannedMinutes = plan?.trainingTasks.reduce((total, task) => total + task.durationMinutes, 0) ?? 0;
  const confirmedDrafts = drafts.filter((draft) => draft.status === "confirmed").length;

  return (
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
  );
}

export async function PlanContent({ userId, today, weekStart }: { userId: string; today: Date; weekStart: Date }) {
  const plan = await getActivePlan(userId);
  const [activities, drafts] = await Promise.all([
    getRecentActivities(userId),
    getDraftsForPlan(userId, plan?.id ?? null)
  ]);
  const nutrition = plan ? JSON.parse(plan.nutritionTargetsJson) : null;

  return (
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
  );
}

function SkeletonLine({ width, height = 12 }: { width: number | string; height?: number }) {
  return (
    <span
      className="skeleton"
      style={{ display: "block", width: typeof width === "number" ? `${width}px` : width, height }}
    />
  );
}

export function HeaderSkeleton({ weekStart, weekEnd }: { weekStart: Date; weekEnd: Date }) {
  return (
    <div className="page-header">
      <div>
        <span className="eyebrow">
          {weekStart.toLocaleDateString()} – {weekEnd.toLocaleDateString()}
        </span>
        <h1>&nbsp;</h1>
        <SkeletonLine width="60%" />
      </div>
      <div className="toolbar">
        <SkeletonLine width={150} height={44} />
        <SkeletonLine width={170} height={44} />
      </div>
    </div>
  );
}

export function TodaySkeleton() {
  return (
    <section className="surface today-card" aria-hidden="true">
      <div className="today-card-main">
        <SkeletonLine width={120} height={12} />
        <SkeletonLine width={220} height={28} />
        <SkeletonLine width="80%" />
      </div>
      <div className="today-card-side">
        <div>
          <SkeletonLine width={80} height={12} />
          <SkeletonLine width={120} height={16} />
        </div>
        <div>
          <SkeletonLine width={80} height={12} />
          <SkeletonLine width={140} height={16} />
        </div>
      </div>
    </section>
  );
}

export function MetricsSkeleton() {
  return (
    <section className="grid metric-grid metric-grid-plan" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, index) => (
        <section className="surface metric-card" key={index}>
          <SkeletonLine width={100} height={12} />
          <SkeletonLine width={70} height={30} />
        </section>
      ))}
    </section>
  );
}

export function ContentSkeleton() {
  return (
    <section className="plan-content-grid" aria-hidden="true">
      <section className="surface panel">
        <SkeletonLine width={160} height={24} />
        <SkeletonLine width="90%" />
        <SkeletonLine width="70%" />
      </section>
      <div className="support-stack">
        <section className="surface panel">
          <SkeletonLine width={120} height={20} />
          <SkeletonLine width="80%" />
        </section>
        <section className="surface panel">
          <SkeletonLine width={120} height={20} />
          <SkeletonLine width="60%" />
        </section>
      </div>
    </section>
  );
}
