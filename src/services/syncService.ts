import { prisma } from "@/src/db/client";
import { normalizeFeishuCalendarSnapshot } from "@/src/providers/calendar";
import { normalizeCorosActivity, normalizeCorosRecovery, normalizeCorosSleep } from "@/src/providers/coros";

export async function importCorosPayload(
  userId: string,
  payload: { activities?: unknown[]; sleep?: unknown[]; recovery?: unknown[] }
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

export async function importCalendarPayload(userId: string, payload: unknown) {
  const snapshot = normalizeFeishuCalendarSnapshot(payload as never);

  return prisma.calendarSnapshot.create({
    data: {
      userId,
      source: snapshot.source,
      rangeStart: snapshot.rangeStart,
      rangeEnd: snapshot.rangeEnd,
      busyWindowsJson: JSON.stringify(snapshot.busyWindows),
      freeWindowsJson: JSON.stringify(snapshot.freeWindows),
      importantEventsJson: JSON.stringify(snapshot.importantEvents)
    }
  });
}
