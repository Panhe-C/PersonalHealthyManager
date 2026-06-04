import { MetricCard } from "@/components/MetricCard";
import { ProfileForm } from "@/components/ProfileForm";
import { SyncDemoDataButton } from "@/components/SyncDemoDataButton";
import { requireUser } from "@/src/auth/session";
import { prisma } from "@/src/db/client";

function parseStringList(value: string | undefined) {
  if (!value) return [];
  return JSON.parse(value) as string[];
}

export default async function ProfilePage() {
  const user = await requireUser();
  const [profile, latestActivity, latestSleep, latestRecovery] = await Promise.all([
    prisma.bodyProfile.findUnique({ where: { userId: user.id } }),
    prisma.activityRecord.findFirst({ where: { userId: user.id }, orderBy: { startedAt: "desc" } }),
    prisma.sleepRecord.findFirst({ where: { userId: user.id }, orderBy: { date: "desc" } }),
    prisma.recoveryRecord.findFirst({ where: { userId: user.id }, orderBy: { date: "desc" } })
  ]);
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
          <h1>Body profile</h1>
          <p className="page-subtitle">Physical context, preferences, and recent health sync status.</p>
        </div>
        <SyncDemoDataButton />
      </div>

      <section className="grid metric-grid">
        <MetricCard
          label="Latest workout"
          value={latestActivity ? latestActivity.sportType : "No data"}
          hint={latestActivity ? latestActivity.startedAt.toLocaleString() : "Sync COROS data"}
        />
        <MetricCard
          label="Sleep"
          value={latestSleep ? `${(latestSleep.durationMinutes / 60).toFixed(1)}h` : "No data"}
          hint={latestSleep ? latestSleep.date.toDateString() : "Sync sleep data"}
        />
        <MetricCard
          label="Recovery"
          value={latestRecovery?.recoveryPercent ? `${latestRecovery.recoveryPercent}%` : "No data"}
          hint={latestRecovery ? latestRecovery.date.toDateString() : "Sync recovery data"}
        />
      </section>

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
