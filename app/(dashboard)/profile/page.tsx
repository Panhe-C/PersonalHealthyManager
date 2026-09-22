import { Activity, HeartPulse, Moon } from "lucide-react";
import { HealthTrendCharts } from "@/components/HealthTrendCharts";
import { MetricCard } from "@/components/MetricCard";
import { ProfileForm } from "@/components/ProfileForm";
import { ProfileInsights } from "@/components/ProfileInsights";
import { SyncDemoDataButton } from "@/components/SyncDemoDataButton";
import { requireUser } from "@/src/auth/session";
import { prisma } from "@/src/db/client";
import { buildDailyTrends } from "@/src/presentation/healthTrends";

function parseStringList(value: string | undefined) {
  if (!value) return [];
  return JSON.parse(value) as string[];
}

const demoDataMarkers = ["demo", "fixture", "smoke", "codex-e2e", "review-smoke"];

function hasDemoMarker(value: string | null | undefined) {
  if (!value) return false;
  const normalized = value.toLowerCase();
  return demoDataMarkers.some((marker) => normalized.includes(marker));
}

function isDemoRecord(record: { sourceId?: string | null; metadataJson?: string | null }) {
  return hasDemoMarker(record.sourceId) || hasDemoMarker(record.metadataJson);
}

function preferLiveRecords<T extends { sourceId?: string | null; metadataJson?: string | null }>(records: T[]) {
  const liveRecords = records.filter((record) => !isDemoRecord(record));
  return liveRecords.length > 0 ? liveRecords : records;
}

function hasDateOnlyMetadata(record: { metadataJson?: string | null }) {
  if (!record.metadataJson) return false;

  try {
    const metadata = JSON.parse(record.metadataJson) as { dateOnly?: unknown };
    return metadata.dateOnly === true;
  } catch {
    return false;
  }
}

function formatActivityHint(record: { startedAt: Date; metadataJson?: string | null }) {
  return hasDateOnlyMetadata(record) ? record.startedAt.toLocaleDateString() : record.startedAt.toLocaleString();
}

export default async function ProfilePage() {
  const user = await requireUser();
  const [profile, allActivities, sleepRecords, recoveryRecords] = await Promise.all([
    prisma.bodyProfile.findUnique({ where: { userId: user.id } }),
    prisma.activityRecord.findMany({ where: { userId: user.id }, orderBy: { startedAt: "desc" }, take: 30 }),
    prisma.sleepRecord.findMany({ where: { userId: user.id }, orderBy: { date: "desc" }, take: 14 }),
    prisma.recoveryRecord.findMany({ where: { userId: user.id }, orderBy: { date: "desc" }, take: 14 })
  ]);
  const activities = preferLiveRecords(allActivities);
  const trendDays = buildDailyTrends({ timezone: user.timezone, activities, sleepRecords, recoveryRecords });
  const latestActivity = activities[0];
  const latestSleep = sleepRecords[0];
  const latestRecovery = recoveryRecords[0];
  const hasDemoData = [...activities, ...sleepRecords, ...recoveryRecords].some(isDemoRecord);
  const initialProfile = profile
    ? {
        heightCm: profile.heightCm,
        weightKg: profile.weightKg,
        bodyFatPercent: profile.bodyFatPercent ?? undefined,
        sex: profile.sex,
        restingHeartRateBpm: profile.restingHeartRateBpm ?? undefined,
        trainingExperience: profile.trainingExperience,
        injuries: parseStringList(profile.injuriesJson),
        dietaryPreferences: parseStringList(profile.dietaryPreferencesJson),
        trainingPreferences: parseStringList(profile.trainingPreferencesJson)
      }
    : null;

  return (
    <main className="page grid" style={{ gap: 20 }}>
      <div className="page-header">
        <div>
          <span className="eyebrow">Body journal</span>
          <h1>Body profile</h1>
          <p className="page-subtitle">Physical context, preferences, and recent health sync status.</p>
        </div>
        <SyncDemoDataButton />
      </div>

      <section className="grid metric-grid">
        <MetricCard
          icon={Activity}
          label="Latest workout"
          value={latestActivity ? latestActivity.sportType : "No data"}
          hint={latestActivity ? formatActivityHint(latestActivity) : "Sync COROS data"}
          tone="clay"
        />
        <MetricCard
          icon={Moon}
          label="Sleep"
          value={latestSleep ? `${(latestSleep.durationMinutes / 60).toFixed(1)}h` : "No data"}
          hint={latestSleep ? latestSleep.date.toDateString() : "Sync sleep data"}
          tone="blue"
        />
        <MetricCard
          icon={HeartPulse}
          label="Recovery"
          value={latestRecovery?.recoveryPercent ? `${latestRecovery.recoveryPercent}%` : "No data"}
          hint={latestRecovery ? latestRecovery.date.toDateString() : "Sync recovery data"}
          tone="sage"
        />
      </section>

      <ProfileInsights
        activities={activities}
        sleepRecords={sleepRecords}
        recoveryRecords={recoveryRecords}
        dataMode={hasDemoData ? "demo" : "live"}
      />

      <HealthTrendCharts days={trendDays} />

      <section>
        <div className="panel-heading">
          <div>
            <h2>Profile details</h2>
            <p className="page-subtitle">Used by the planning engine to keep training appropriate.</p>
          </div>
        </div>
        <ProfileForm initialProfile={initialProfile} />
      </section>
    </main>
  );
}
