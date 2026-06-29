import { Suspense } from "react";
import { requireUser } from "@/src/auth/session";
import {
  ContentSkeleton,
  HeaderSkeleton,
  MetricsSkeleton,
  PlanContent,
  PlanHeader,
  PlanMetrics,
  SetupChecklist,
  TodaySkeleton,
  TodaySummary
} from "./_sections";

export default async function PlanPage() {
  const user = await requireUser();
  const today = new Date();
  const day = today.getDay() === 0 ? 7 : today.getDay();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - day + 1);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);

  return (
    <main className="page grid" style={{ gap: 20 }}>
      <Suspense fallback={<HeaderSkeleton weekStart={weekStart} weekEnd={weekEnd} />}>
        <PlanHeader userId={user.id} weekStart={weekStart} weekEnd={weekEnd} />
      </Suspense>

      <Suspense fallback={<TodaySkeleton />}>
        <TodaySummary userId={user.id} today={today} />
      </Suspense>

      <Suspense fallback={null}>
        <SetupChecklist userId={user.id} weekStart={weekStart} weekEnd={weekEnd} />
      </Suspense>

      <Suspense fallback={<MetricsSkeleton />}>
        <PlanMetrics userId={user.id} />
      </Suspense>

      <Suspense fallback={<ContentSkeleton />}>
        <PlanContent userId={user.id} today={today} weekStart={weekStart} />
      </Suspense>
    </main>
  );
}
