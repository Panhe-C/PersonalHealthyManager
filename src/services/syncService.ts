import { prisma } from "@/src/db/client";
import { normalizeFeishuCalendarSnapshot } from "@/src/providers/calendar";
import { normalizeCorosActivity, normalizeCorosRecovery, normalizeCorosSleep } from "@/src/providers/coros";
import { fetchCorosRemoteMcpSnapshot } from "@/src/providers/coros-mcp";
import { loadDataMcpConnection } from "@/src/settings/service";

type CorosImportPayload = {
  activities?: unknown[];
  sleep?: unknown[];
  recovery?: unknown[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function parseJsonText(value: unknown): unknown {
  if (typeof value !== "string") return null;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizeCorosMcpPayload(payload: unknown): CorosImportPayload {
  if (!isRecord(payload)) return {};

  if (Array.isArray(payload.activities) || Array.isArray(payload.sleep) || Array.isArray(payload.recovery)) {
    return {
      activities: Array.isArray(payload.activities) ? payload.activities : undefined,
      sleep: Array.isArray(payload.sleep) ? payload.sleep : undefined,
      recovery: Array.isArray(payload.recovery) ? payload.recovery : undefined
    };
  }

  for (const key of ["data", "result", "payload"] as const) {
    const nested = normalizeCorosMcpPayload(payload[key]);
    if (nested.activities || nested.sleep || nested.recovery) return nested;
  }

  if (Array.isArray(payload.content)) {
    for (const item of payload.content) {
      if (!isRecord(item)) continue;
      const nested = normalizeCorosMcpPayload(item);
      if (nested.activities || nested.sleep || nested.recovery) return nested;

      const parsed = normalizeCorosMcpPayload(parseJsonText(item.text));
      if (parsed.activities || parsed.sleep || parsed.recovery) return parsed;
    }
  }

  return {};
}

export async function importCorosPayload(
  userId: string,
  payload: CorosImportPayload
) {
  const activities = (payload.activities ?? []).map((item) => normalizeCorosActivity(item as never));
  const sleepRecords = (payload.sleep ?? []).map((item) => normalizeCorosSleep(item as never));
  const recoveryRecords = (payload.recovery ?? []).map((item) => normalizeCorosRecovery(item as never));

  await prisma.$transaction(async (tx) => {
    for (const activity of activities) {
      const data = {
        userId,
        source: activity.source,
        sourceId: activity.sourceId,
        sportType: activity.sportType,
        startedAt: activity.startedAt,
        endedAt: activity.endedAt,
        durationMinutes: activity.durationMinutes,
        distanceKm: activity.distanceKm,
        averagePaceSecPerKm: activity.averagePaceSecPerKm,
        averageSpeedKph: activity.averageSpeedKph,
        averageHeartRateBpm: activity.averageHeartRateBpm,
        calories: activity.calories,
        trainingLoad: activity.trainingLoad,
        intensity: activity.intensity,
        metadataJson: JSON.stringify(activity.metadata)
      };

      await tx.activityRecord.upsert({
        where: {
          userId_source_sourceId: {
            userId,
            source: activity.source,
            sourceId: activity.sourceId
          }
        },
        update: data,
        create: data
      });
    }

    for (const sleep of sleepRecords) {
      const data = {
        userId,
        source: sleep.source,
        date: sleep.date,
        sleepStart: sleep.sleepStart,
        sleepEnd: sleep.sleepEnd,
        durationMinutes: sleep.durationMinutes,
        qualityScore: sleep.qualityScore,
        metadataJson: JSON.stringify(sleep.metadata)
      };

      await tx.sleepRecord.upsert({
        where: {
          userId_source_date: {
            userId,
            source: sleep.source,
            date: sleep.date
          }
        },
        update: data,
        create: data
      });
    }

    for (const recovery of recoveryRecords) {
      const data = {
        userId,
        source: recovery.source,
        date: recovery.date,
        recoveryPercent: recovery.recoveryPercent,
        hrvMs: recovery.hrvMs,
        restingHeartRateBpm: recovery.restingHeartRateBpm,
        stressLevel: recovery.stressLevel,
        trainingLoadShortTerm: recovery.trainingLoadShortTerm,
        trainingLoadLongTerm: recovery.trainingLoadLongTerm,
        metadataJson: JSON.stringify(recovery.metadata)
      };

      await tx.recoveryRecord.upsert({
        where: {
          userId_source_date: {
            userId,
            source: recovery.source,
            date: recovery.date
          }
        },
        update: data,
        create: data
      });
    }
  });

  return { activities: activities.length, sleep: sleepRecords.length, recovery: recoveryRecords.length };
}

export async function syncCorosFromSettings(userId: string) {
  const connection = await loadDataMcpConnection(userId, "coros");
  if (!connection?.enabled) throw new Error("COROS MCP connection is disabled.");
  if (!connection.endpoint) throw new Error("COROS MCP endpoint is not configured.");

  const snapshot = await fetchCorosRemoteMcpSnapshot(connection);
  return importCorosPayload(userId, snapshot);
}

export async function importCalendarPayload(userId: string, payload: unknown) {
  const snapshot = normalizeFeishuCalendarSnapshot(payload as never);
  const data = {
    userId,
    source: snapshot.source,
    rangeStart: snapshot.rangeStart,
    rangeEnd: snapshot.rangeEnd,
    busyWindowsJson: JSON.stringify(snapshot.busyWindows),
    freeWindowsJson: JSON.stringify(snapshot.freeWindows),
    importantEventsJson: JSON.stringify(snapshot.importantEvents)
  };

  return prisma.$transaction(async (tx) => {
    const existing = await tx.calendarSnapshot.findFirst({
      where: {
        userId,
        source: snapshot.source,
        rangeStart: snapshot.rangeStart,
        rangeEnd: snapshot.rangeEnd
      }
    });

    if (existing) {
      return tx.calendarSnapshot.update({
        where: { id: existing.id },
        data
      });
    }

    return tx.calendarSnapshot.create({ data });
  });
}
