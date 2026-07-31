import { prisma } from "@/src/db/client";
import { normalizeFeishuCalendarSnapshot } from "@/src/providers/calendar";
import { normalizeCorosActivity, normalizeCorosRecovery, normalizeCorosSleep } from "@/src/providers/coros";
import { fetchCorosRemoteMcpSnapshot } from "@/src/providers/coros-mcp";
import { loadDataMcpConnection } from "@/src/settings/service";
import { fetchLarkCalendarPayload } from "@/src/providers/lark-calendar-read";

type CorosImportPayload = {
  activities?: unknown[];
  sleep?: unknown[];
  recovery?: unknown[];
  profile?: unknown[];
};

type CorosProfilePayload = {
  heightCm?: number;
  weightKg?: number;
  birthday?: string;
  sex?: string;
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

  if (Array.isArray(payload.activities) || Array.isArray(payload.sleep) || Array.isArray(payload.recovery) || Array.isArray(payload.profile)) {
    return {
      activities: Array.isArray(payload.activities) ? payload.activities : undefined,
      sleep: Array.isArray(payload.sleep) ? payload.sleep : undefined,
      recovery: Array.isArray(payload.recovery) ? payload.recovery : undefined,
      profile: Array.isArray(payload.profile) ? payload.profile : undefined
    };
  }

  for (const key of ["data", "result", "payload"] as const) {
    const nested = normalizeCorosMcpPayload(payload[key]);
    if (nested.activities || nested.sleep || nested.recovery || nested.profile) return nested;
  }

  if (Array.isArray(payload.content)) {
    for (const item of payload.content) {
      if (!isRecord(item)) continue;
      const nested = normalizeCorosMcpPayload(item);
      if (nested.activities || nested.sleep || nested.recovery || nested.profile) return nested;

      const parsed = normalizeCorosMcpPayload(parseJsonText(item.text));
      if (parsed.activities || parsed.sleep || parsed.recovery || parsed.profile) return parsed;
    }
  }

  return {};
}

/**
 * Normalize each record independently so a single malformed item (e.g. an unparseable timestamp)
 * is skipped and logged rather than failing the entire sync.
 */
function normalizeAll<T>(items: unknown[] | undefined, normalize: (item: never) => T, kind: string): T[] {
  const normalized: T[] = [];
  for (const item of items ?? []) {
    try {
      normalized.push(normalize(item as never));
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.warn(`Skipping invalid COROS ${kind} record: ${reason} Raw: ${JSON.stringify(item).slice(0, 300)}`);
    }
  }
  return normalized;
}

function normalizeCorosProfile(item: unknown): CorosProfilePayload | null {
  if (!isRecord(item)) return null;

  const heightCm = typeof item.heightCm === "number" ? item.heightCm : undefined;
  const weightKg = typeof item.weightKg === "number" ? item.weightKg : undefined;
  const birthday = typeof item.birthday === "string" ? item.birthday : undefined;
  const sex = typeof item.sex === "string" ? item.sex.toLowerCase() : undefined;

  if (heightCm == null && weightKg == null && !birthday && !sex) return null;
  return {
    ...(heightCm != null ? { heightCm } : {}),
    ...(weightKg != null ? { weightKg } : {}),
    ...(birthday ? { birthday } : {}),
    ...(sex === "male" || sex === "female" ? { sex } : {})
  };
}

function definedEntries<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, entryValue]) => entryValue !== undefined));
}

export async function importCorosPayload(
  userId: string,
  payload: CorosImportPayload
) {
  const activities = normalizeAll(payload.activities, normalizeCorosActivity, "activity");
  const sleepRecords = normalizeAll(payload.sleep, normalizeCorosSleep, "sleep");
  const recoveryRecords = normalizeAll(payload.recovery, normalizeCorosRecovery, "recovery");
  const profile = normalizeCorosProfile(payload.profile?.[0]);

  await prisma.$transaction(async (tx) => {
    if (profile?.heightCm != null && profile.weightKg != null && profile.sex) {
      const data = definedEntries({
        heightCm: profile.heightCm,
        weightKg: profile.weightKg,
        birthday: profile.birthday ? new Date(`${profile.birthday}T00:00:00+08:00`) : undefined,
        sex: profile.sex
      });

      await tx.bodyProfile.upsert({
        where: { userId },
        update: data,
        create: {
          userId,
          heightCm: profile.heightCm,
          weightKg: profile.weightKg,
          birthday: profile.birthday ? new Date(`${profile.birthday}T00:00:00+08:00`) : undefined,
          sex: profile.sex,
          trainingExperience: "beginner",
          injuriesJson: "[]",
          dietaryPreferencesJson: "[]",
          trainingPreferencesJson: "[]"
        }
      });
    }

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
        deepSleepMinutes: sleep.deepSleepMinutes,
        lightSleepMinutes: sleep.lightSleepMinutes,
        remSleepMinutes: sleep.remSleepMinutes,
        awakeMinutes: sleep.awakeMinutes,
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

export async function syncCorosFromSettings(userId: string, options?: { days?: number }) {
  const connection = await loadDataMcpConnection(userId, "coros");
  if (!connection?.enabled) throw new Error("COROS MCP connection is disabled.");
  if (!connection.endpoint) throw new Error("COROS MCP endpoint is not configured.");

  const snapshot = await fetchCorosRemoteMcpSnapshot(connection, options);
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

export async function syncCalendarFromLarkCli(userId: string, now = new Date()) {
  return importCalendarPayload(userId, await fetchLarkCalendarPayload(now));
}
