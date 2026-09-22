import React from "react";
import type { TrendDay } from "@/src/presentation/healthTrends";

const W = 280;
const H = 72;
const PAD_X = 6;
const PAD_Y = 8;

function formatHours(minutes: number) {
  return `${(minutes / 60).toFixed(1)}h`;
}

function lastDefined<T>(values: (T | null)[]): T | null {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = values[index];
    if (value != null) return value;
  }
  return null;
}

function ChartCard({ title, value, children }: { title: string; value: string; children: React.ReactNode }) {
  return (
    <article className="chart-card">
      <div className="chart-card-heading">
        <span>{title}</span>
        <strong>{value}</strong>
      </div>
      {children}
    </article>
  );
}

function XLabels({ labels }: { labels: string[] }) {
  return (
    <div className="chart-x-labels" style={{ gridTemplateColumns: `repeat(${labels.length}, 1fr)` }} aria-hidden="true">
      {labels.map((label, index) => (
        <span key={index}>{label}</span>
      ))}
    </div>
  );
}

function LineChart({ values, labels }: { values: (number | null)[]; labels: string[] }) {
  const defined = values.filter((value): value is number => value != null);
  if (defined.length === 0) return <div className="trend-empty chart-empty">No data yet.</div>;

  const min = Math.min(...defined);
  const max = Math.max(...defined);
  const span = max - min || Math.max(1, max * 0.1);
  const low = min - span * 0.15;
  const high = max + span * 0.15;

  const x = (index: number) => PAD_X + (index * (W - 2 * PAD_X)) / Math.max(1, values.length - 1);
  const y = (value: number) => H - PAD_Y - ((value - low) / (high - low)) * (H - 2 * PAD_Y);

  const segments: { command: string; points: { x: number; y: number; index: number }[] }[] = [];
  let current: { x: number; y: number; index: number }[] = [];
  values.forEach((value, index) => {
    if (value == null) {
      if (current.length > 0) segments.push({ command: "L", points: current });
      current = [];
      return;
    }
    current.push({ x: x(index), y: y(value), index });
  });
  if (current.length > 0) segments.push({ command: "L", points: current });

  const latest = values.reduce<{ x: number; y: number } | null>((found, value, index) => {
    return value == null ? found : { x: x(index), y: y(value) };
  }, null);

  return (
    <div>
      <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Trend line chart">
        {segments.map((segment, segmentIndex) => {
          const linePath = segment.points
            .map((point, pointIndex) => `${pointIndex === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
            .join(" ");
          const first = segment.points[0];
          const last = segment.points[segment.points.length - 1];
          const areaPath = `${linePath} L${last.x.toFixed(1)} ${H - PAD_Y} L${first.x.toFixed(1)} ${H - PAD_Y} Z`;
          return (
            <g key={segmentIndex}>
              <path d={areaPath} fill="currentColor" opacity={0.1} stroke="none" />
              <path d={linePath} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </g>
          );
        })}
        {latest ? <circle cx={latest.x} cy={latest.y} r={3.5} fill="currentColor" /> : null}
      </svg>
      <XLabels labels={labels} />
    </div>
  );
}

function BarChart({ values, labels, todayIndex }: { values: number[]; labels: string[]; todayIndex: number }) {
  if (values.every((value) => value <= 0)) return <div className="trend-empty chart-empty">No data yet.</div>;

  const max = Math.max(...values, 1);
  const slot = W / values.length;
  const barWidth = slot * 0.52;

  return (
    <div>
      <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Daily bar chart">
        {values.map((value, index) => {
          if (value <= 0) return null;
          const height = Math.max(4, (value / max) * (H - 14));
          return (
            <rect
              key={index}
              x={slot * index + (slot - barWidth) / 2}
              y={H - PAD_Y - height}
              width={barWidth}
              height={height}
              rx={3}
              fill="currentColor"
              opacity={index === todayIndex ? 1 : 0.55}
            />
          );
        })}
      </svg>
      <XLabels labels={labels} />
    </div>
  );
}

const SLEEP_TICKS = ["18:00", "21:00", "00:00", "03:00", "06:00", "09:00", "12:00"];

function SleepScheduleChart({ days }: { days: TrendDay[] }) {
  const rows = days.filter((day) => day.sleepWindowStart != null && day.sleepWindowDuration != null);
  if (rows.length < 2) return null;

  const rowHeight = 13;
  const barHeight = 7;
  const gutter = 34;
  const chartWidth = W - gutter;
  const height = days.length * rowHeight + 4;

  return (
    <div>
      <svg className="chart-svg" viewBox={`0 0 ${W} ${height}`} role="img" aria-label="Sleep schedule chart">
        {days.map((day, index) => {
          const centerY = index * rowHeight + rowHeight / 2 + 2;
          const hasWindow = day.sleepWindowStart != null && day.sleepWindowDuration != null;
          return (
            <g key={day.key}>
              <text x={0} y={centerY + 3} className="chart-svg-label">
                {day.label}
              </text>
              <rect x={gutter} y={centerY - 0.5} width={chartWidth} height={1} fill="currentColor" opacity={0.12} />
              {hasWindow ? (
                <rect
                  x={gutter + (day.sleepWindowStart! / 1440) * chartWidth}
                  y={centerY - barHeight / 2}
                  width={Math.max(4, (day.sleepWindowDuration! / 1440) * chartWidth)}
                  height={barHeight}
                  rx={3.5}
                  fill="currentColor"
                  opacity={day.isToday ? 1 : 0.6}
                />
              ) : null}
            </g>
          );
        })}
      </svg>
      <div className="chart-time-labels" aria-hidden="true">
        {SLEEP_TICKS.map((tick, index) => {
          const left = ((gutter + ((3 + index * 3) / 24) * chartWidth) / W) * 100;
          return (
            <span key={tick} style={{ left: `${left.toFixed(2)}%` }}>
              {tick}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function HealthTrendCharts({ days }: { days: TrendDay[] }) {
  const labels = days.map((day) => day.label);
  const todayIndex = Math.max(0, days.findIndex((day) => day.isToday));

  const trainingMinutes = days.map((day) => day.trainingMinutes);
  const totalMinutes = trainingMinutes.reduce((total, value) => total + value, 0);
  const heartRates = days.map((day) => day.averageHeartRateBpm);
  const latestHeartRate = lastDefined(heartRates);

  const sleepMinutes = days.map((day) => day.sleepMinutes);
  const latestSleep = lastDefined(sleepMinutes);
  const qualityScores = days.map((day) => day.sleepQualityScore);
  const latestQuality = lastDefined(qualityScores);

  const recovery = days.map((day) => day.recoveryPercent);
  const latestRecovery = lastDefined(recovery);
  const hrv = days.map((day) => day.hrvMs);
  const latestHrv = lastDefined(hrv);
  const restingHr = days.map((day) => day.restingHeartRateBpm);
  const latestRestingHr = lastDefined(restingHr);
  const hasSchedule = days.filter((day) => day.sleepWindowStart != null && day.sleepWindowDuration != null).length >= 2;

  const hasAny =
    totalMinutes > 0 ||
    latestHeartRate != null ||
    latestSleep != null ||
    latestRecovery != null ||
    latestHrv != null ||
    latestRestingHr != null;
  if (!hasAny) return null;

  return (
    <section className="surface panel trend-charts">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Trend charts</span>
          <h2>The last 7 days, day by day</h2>
          <p className="page-subtitle">Training load, sleep rhythm, and body state on a daily grid.</p>
        </div>
      </div>

      <div className="trend-charts-groups">
        <div className="chart-group">
          <h3>Training</h3>
          <div className="trend-chart-grid">
            <ChartCard title="Training time" value={`${totalMinutes} min`}>
              <span style={{ color: "var(--blue)" }}>
                <BarChart values={trainingMinutes} labels={labels} todayIndex={todayIndex} />
              </span>
            </ChartCard>
            <ChartCard title="Avg heart rate" value={latestHeartRate != null ? `${latestHeartRate} bpm` : "No data"}>
              <span style={{ color: "var(--clay)" }}>
                <LineChart values={heartRates} labels={labels} />
              </span>
            </ChartCard>
          </div>
        </div>

        <div className="chart-group">
          <h3>Sleep</h3>
          <div className="trend-chart-grid">
            <ChartCard title="Sleep schedule" value={latestSleep != null ? formatHours(latestSleep) : "No data"}>
              <span style={{ color: "var(--blue)" }}>
                {hasSchedule ? (
                  <SleepScheduleChart days={days} />
                ) : (
                  <BarChart values={sleepMinutes.map((value) => value ?? 0)} labels={labels} todayIndex={todayIndex} />
                )}
              </span>
            </ChartCard>
            <ChartCard title="Sleep quality" value={latestQuality != null ? `${latestQuality}` : "No data"}>
              <span style={{ color: "var(--blue)" }}>
                <LineChart values={qualityScores} labels={labels} />
              </span>
            </ChartCard>
          </div>
        </div>

        <div className="chart-group">
          <h3>Body state</h3>
          <div className="trend-chart-grid">
            <ChartCard title="Recovery" value={latestRecovery != null ? `${latestRecovery}%` : "No data"}>
              <span style={{ color: "var(--sage)" }}>
                <LineChart values={recovery} labels={labels} />
              </span>
            </ChartCard>
            <ChartCard title="HRV" value={latestHrv != null ? `${Math.round(latestHrv)} ms` : "No data"}>
              <span style={{ color: "var(--sage)" }}>
                <LineChart values={hrv} labels={labels} />
              </span>
            </ChartCard>
            <ChartCard title="Resting HR" value={latestRestingHr != null ? `${latestRestingHr} bpm` : "No data"}>
              <span style={{ color: "var(--clay)" }}>
                <LineChart values={restingHr} labels={labels} />
              </span>
            </ChartCard>
          </div>
        </div>
      </div>
    </section>
  );
}
