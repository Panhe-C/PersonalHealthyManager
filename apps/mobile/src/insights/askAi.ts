import type { ActivityRecord, SleepRecord } from "../api/schemas";
import {
  formatDateLabel,
  formatDuration,
  formatTaskWindow,
  intensityLabel,
  sportTypeLabel
} from "../ui/format";

function formatPace(seconds: number | null) {
  if (seconds === null || seconds <= 0) return null;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return `${minutes}:${String(rest).padStart(2, "0")} /km`;
}

/** Build a coach prompt that asks for analysis of one activity session. */
export function buildActivityAnalysisPrompt(activity: ActivityRecord): string {
  const facts = [
    `项目：${sportTypeLabel(activity.sportType)}`,
    `时间：${formatDateLabel(activity.startedAt)} ${formatTaskWindow(activity.startedAt, activity.endedAt)}`,
    `时长：${formatDuration(activity.durationMinutes)}`,
    `强度：${intensityLabel(activity.intensity)}`
  ];

  if (activity.distanceKm !== null) facts.push(`距离：${Number(activity.distanceKm.toFixed(2))} km`);
  if (activity.averageHeartRateBpm !== null) facts.push(`平均心率：${activity.averageHeartRateBpm} bpm`);
  const pace = formatPace(activity.averagePaceSecPerKm);
  if (pace) facts.push(`平均配速：${pace}`);
  if (activity.calories !== null) facts.push(`热量：${activity.calories} kcal`);
  if (activity.trainingLoad !== null) facts.push(`训练负荷：${Math.round(activity.trainingLoad)}`);

  return [
    "请分析我这次运动数据：",
    facts.join("；"),
    "结合最近恢复和训练负荷，评估这次训练是否合适，并给出恢复与下次训练建议。"
  ].join("");
}

/** Build a coach prompt that asks for analysis of one sleep night. */
export function buildSleepAnalysisPrompt(record: SleepRecord): string {
  const facts = [
    `日期：${formatDateLabel(record.date)}`,
    `时长：${formatDuration(record.durationMinutes)}`
  ];

  if (record.sleepStart && record.sleepEnd) {
    facts.push(`时段：${formatTaskWindow(record.sleepStart, record.sleepEnd)}`);
  }
  if (record.qualityScore !== null) facts.push(`质量评分：${record.qualityScore}`);
  if (record.deepSleepMinutes != null) facts.push(`深睡：${formatDuration(record.deepSleepMinutes)}`);
  if (record.lightSleepMinutes != null) facts.push(`浅睡：${formatDuration(record.lightSleepMinutes)}`);
  if (record.remSleepMinutes != null) facts.push(`REM：${formatDuration(record.remSleepMinutes)}`);
  if (record.awakeMinutes != null) facts.push(`清醒：${formatDuration(record.awakeMinutes)}`);

  return [
    "请分析我这晚的睡眠数据：",
    facts.join("；"),
    "结合最近训练负荷，评估恢复是否充分，并给出今天训练强度建议。"
  ].join("");
}
