import type {
  MealMenu,
  NormalizedCalendarSnapshot,
  NormalizedRecoveryRecord,
  NormalizedSleepRecord
} from "@/src/domain/models";

export function recovery(overrides: Partial<NormalizedRecoveryRecord> = {}): NormalizedRecoveryRecord {
  return {
    source: "coros",
    date: new Date("2026-06-02T00:00:00+08:00"),
    recoveryPercent: 80,
    hrvMs: 55,
    restingHeartRateBpm: 52,
    metadata: {},
    ...overrides
  };
}

export function sleep(overrides: Partial<NormalizedSleepRecord> = {}): NormalizedSleepRecord {
  return {
    source: "coros",
    date: new Date("2026-06-02T00:00:00+08:00"),
    durationMinutes: 450,
    qualityScore: 82,
    metadata: {},
    ...overrides
  };
}

export function calendarSnapshot(overrides: Partial<NormalizedCalendarSnapshot> = {}): NormalizedCalendarSnapshot {
  return {
    source: "feishu",
    rangeStart: new Date("2026-06-01T00:00:00+08:00"),
    rangeEnd: new Date("2026-06-07T23:59:59+08:00"),
    busyWindows: [],
    freeWindows: [
      { start: "2026-06-02T10:00:00.000Z", end: "2026-06-02T11:00:00.000Z" }
    ],
    importantEvents: [],
    ...overrides
  };
}

export function mealMenus(): MealMenu[] {
  return [
    {
      source: "mock",
      date: new Date("2026-06-02T00:00:00+08:00"),
      meal: "lunch",
      items: [
        {
          name: "Chicken rice bowl",
          calories: 680,
          proteinGrams: 42,
          carbohydrateGrams: 72,
          fatGrams: 20,
          tags: ["high-protein"]
        },
        {
          name: "Fried noodles",
          calories: 830,
          proteinGrams: 25,
          carbohydrateGrams: 96,
          fatGrams: 34,
          tags: ["fried"]
        }
      ]
    }
  ];
}
