import React from "react";
import { Activity, HeartPulse, Moon, TrendingUp } from "lucide-react";

type ProfileInsightActivity = {
  id: string;
  sportType: string;
  startedAt: Date;
  metadataJson?: string | null;
  durationMinutes: number;
  distanceKm?: number | null;
  averageHeartRateBpm?: number | null;
  trainingLoad?: number | null;
  intensity: string;
};

type ProfileInsightSleep = {
  id: string;
  date: Date;
  durationMinutes: number;
  qualityScore?: number | null;
};

type ProfileInsightRecovery = {
  id: string;
  date: Date;
  recoveryPercent?: number | null;
  hrvMs?: number | null;
  restingHeartRateBpm?: number | null;
  trainingLoadShortTerm?: number | null;
  trainingLoadLongTerm?: number | null;
};

type TrendPoint = {
  id: string;
  label: string;
  value: number;
  display: string;
};

type ProfileInsightsProps = {
  activities: ProfileInsightActivity[];
  sleepRecords: ProfileInsightSleep[];
  recoveryRecords: ProfileInsightRecovery[];
  dataMode?: "live" | "demo";
};

const dateFormatter = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });

function formatDay(date: Date) {
  return dateFormatter.format(date);
}

function formatHours(minutes: number) {
  return `${(minutes / 60).toFixed(1)}h`;
}

function compactNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function hasDateOnlyMetadata(activity: ProfileInsightActivity) {
  if (!activity.metadataJson) return false;

  try {
    const metadata = JSON.parse(activity.metadataJson) as { dateOnly?: unknown };
    return metadata.dateOnly === true;
  } catch {
    return false;
  }
}

function formatActivityTimestamp(activity: ProfileInsightActivity) {
  if (hasDateOnlyMetadata(activity)) {
    // Date-only COROS rows are calendar dates in the app timezone; pin the
    // formatter so UTC CI runners don't shift the day backward.
    return new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "Asia/Shanghai"
    }).format(activity.startedAt);
  }

  return activity.startedAt.toLocaleString();
}

function sortByDate<T>(items: T[], getDate: (item: T) => Date) {
  return items.slice().sort((left, right) => getDate(left).getTime() - getDate(right).getTime());
}

function buildRecoveryPoints(records: ProfileInsightRecovery[]): TrendPoint[] {
  return sortByDate(records, (record) => record.date)
    .flatMap((record) =>
      record.recoveryPercent == null
        ? []
        : [
            {
              id: record.id,
              label: formatDay(record.date),
              value: record.recoveryPercent,
              display: `${record.recoveryPercent}%`
            }
          ]
    );
}

function buildSleepPoints(records: ProfileInsightSleep[]): TrendPoint[] {
  return sortByDate(records, (record) => record.date).map((record) => ({
      id: record.id,
      label: formatDay(record.date),
      value: record.durationMinutes,
      display: formatHours(record.durationMinutes)
    }));
}

function buildLoadPoints(activities: ProfileInsightActivity[]): TrendPoint[] {
  return sortByDate(activities, (activity) => activity.startedAt)
    .flatMap((activity) =>
      activity.trainingLoad == null
        ? []
        : [
            {
              id: activity.id,
              label: formatDay(activity.startedAt),
              value: activity.trainingLoad,
              display: compactNumber(activity.trainingLoad)
            }
          ]
    );
}

function readinessLabel(value?: number | null) {
  if (value == null) return "Pending sync";
  if (value < 50) return "Keep it gentle";
  if (value < 70) return "Build carefully";
  return "Ready to train";
}

function ReadinessDial({ recoveryRecords }: { recoveryRecords: ProfileInsightRecovery[] }) {
  const sorted = sortByDate(recoveryRecords, (record) => record.date);
  const latest = sorted.at(-1);
  const value = latest?.recoveryPercent ?? 0;
  const points = buildRecoveryPoints(recoveryRecords);
  const dialStyle = { "--dial-value": `${Math.max(0, Math.min(100, value))}%` } as React.CSSProperties;

  return (
    <article className="readiness-card" aria-label="Readiness dial">
      <div className="insight-section-heading">
        <span>Readiness dial</span>
        <strong>{latest ? formatDay(latest.date) : "No date"}</strong>
      </div>
      <div className="readiness-dial" style={dialStyle}>
        <div className="readiness-dial-core">
          <span>{latest?.recoveryPercent != null ? `${latest.recoveryPercent}%` : "No data"}</span>
          <small>{readinessLabel(latest?.recoveryPercent)}</small>
        </div>
      </div>
      <ul className="recovery-rhythm" aria-label="Recent recovery rhythm">
        {points.length > 0 ? (
          points.map((point) => (
            <li key={point.id}>
              <span>{point.label}</span>
              <strong>{point.display}</strong>
            </li>
          ))
        ) : (
          <li>
            <span>Recovery</span>
            <strong>Waiting</strong>
          </li>
        )}
      </ul>
    </article>
  );
}

function SleepRunway({ sleepRecords }: { sleepRecords: ProfileInsightSleep[] }) {
  const points = buildSleepPoints(sleepRecords);
  const sorted = sortByDate(sleepRecords, (record) => record.date);
  const latest = sorted.at(-1);

  return (
    <article className="runway-card">
      <div className="insight-section-heading">
        <span>Sleep runway</span>
        <strong>{latest ? formatHours(latest.durationMinutes) : "No data"}</strong>
      </div>
      {points.length > 0 ? (
        <ul className="sleep-runway" aria-label="Recent sleep runway">
          {points.map((point) => {
            const width = Math.max(20, Math.min(100, Math.round((point.value / 540) * 100)));
            return (
              <li key={point.id} style={{ "--sleep-width": `${width}%` } as React.CSSProperties}>
                <span className="sleep-runway-date">{point.label}</span>
                <span className="sleep-runway-track">
                  <span />
                </span>
                <strong>{point.display}</strong>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="trend-empty">Waiting for synced sleep.</div>
      )}
    </article>
  );
}

function LoadMosaic({ activities }: { activities: ProfileInsightActivity[] }) {
  const sorted = sortByDate(activities, (activity) => activity.startedAt);

  return (
    <article className="load-mosaic-card">
      <div className="insight-section-heading">
        <span>Load mosaic</span>
        <strong>{sorted.length} sessions</strong>
      </div>
      {sorted.length > 0 ? (
        <ul className="load-mosaic" aria-label="Recent training load mosaic">
          {sorted.map((activity) => {
            const load = activity.trainingLoad ?? 0;
            return (
              <li className={`load-tile load-tile-${activity.intensity}`} key={activity.id}>
                <span>{formatDay(activity.startedAt)}</span>
                <strong>{load > 0 ? compactNumber(load) : "—"}</strong>
                <em>{activity.sportType}</em>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="trend-empty">Waiting for synced training.</div>
      )}
    </article>
  );
}

function SignalTiles({
  recoveryRecords,
  sleepRecords
}: {
  recoveryRecords: ProfileInsightRecovery[];
  sleepRecords: ProfileInsightSleep[];
}) {
  const latestRecovery = sortByDate(recoveryRecords, (record) => record.date).at(-1);
  const latestSleep = sortByDate(sleepRecords, (record) => record.date).at(-1);

  const signals = [
    {
      icon: HeartPulse,
      label: "HRV",
      value: latestRecovery?.hrvMs != null ? `${compactNumber(latestRecovery.hrvMs)} ms` : "No data"
    },
    {
      icon: Activity,
      label: "Resting HR",
      value: latestRecovery?.restingHeartRateBpm != null ? `${latestRecovery.restingHeartRateBpm} bpm` : "No data"
    },
    {
      icon: Moon,
      label: "Sleep score",
      value: latestSleep?.qualityScore != null ? `${latestSleep.qualityScore}` : "No data"
    }
  ];

  return (
    <div className="signal-strip">
      {signals.map((signal) => {
        const Icon = signal.icon;
        return (
          <div key={signal.label}>
            <Icon aria-hidden="true" size={15} />
            <span>{signal.label}</span>
            <strong>{signal.value}</strong>
          </div>
        );
      })}
    </div>
  );
}

function LatestWorkout({ activity }: { activity?: ProfileInsightActivity }) {
  const stats = activity
    ? [
        { label: "Duration", value: `${activity.durationMinutes} min` },
        { label: "Distance", value: activity.distanceKm != null ? `${activity.distanceKm.toFixed(1)} km` : "No distance" },
        { label: "Heart rate", value: activity.averageHeartRateBpm != null ? `${activity.averageHeartRateBpm} bpm` : "No HR" }
      ]
    : [];

  return (
    <aside className="session-card">
      <div className="session-card-mark">
        <Activity aria-hidden="true" size={18} />
      </div>
      <div className="session-card-main">
        <span className="metric-label">Latest session</span>
        {activity ? (
          <>
            <strong>
              {activity.sportType} · {activity.intensity}
            </strong>
            <p className="page-subtitle">{formatActivityTimestamp(activity)}</p>
            <dl className="session-stat-list">
              {stats.map((stat) => (
                <div key={stat.label}>
                  <dt>{stat.label}</dt>
                  <dd>{stat.value}</dd>
                </div>
              ))}
            </dl>
          </>
        ) : (
          <>
            <strong>No activity yet</strong>
            <p className="page-subtitle">Sync COROS data to compare workload against recovery.</p>
          </>
        )}
      </div>
    </aside>
  );
}

export function ProfileInsights({ activities, sleepRecords, recoveryRecords, dataMode = "live" }: ProfileInsightsProps) {
  const hasAnyData =
    recoveryRecords.some((record) => record.recoveryPercent != null) || sleepRecords.length > 0 || activities.length > 0;
  const isDemoData = dataMode === "demo";

  return (
    <section className="surface panel profile-insights">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Synced signals</span>
          <h2>Health trends</h2>
          <p className="page-subtitle">A less tidy, more useful read on readiness, sleep rhythm, and training strain.</p>
        </div>
        <div className={isDemoData ? "insight-badge insight-badge-demo" : "insight-badge"}>
          <TrendingUp aria-hidden="true" size={16} />
          {isDemoData ? (
            <>
              <span>Demo data</span>
              <span aria-hidden="true">·</span>
            </>
          ) : null}
          <span>7-day window</span>
        </div>
      </div>

      {hasAnyData ? (
        <div className="profile-insights-mosaic">
          <ReadinessDial recoveryRecords={recoveryRecords} />
          <div className="insight-stack">
            <SleepRunway sleepRecords={sleepRecords} />
            <LoadMosaic activities={activities} />
          </div>
          <div className="insight-side">
            <LatestWorkout activity={sortByDate(activities, (activity) => activity.startedAt).at(-1)} />
            <SignalTiles recoveryRecords={recoveryRecords} sleepRecords={sleepRecords} />
          </div>
        </div>
      ) : (
        <div className="empty-state">Sync COROS data to unlock trend charts.</div>
      )}
    </section>
  );
}
