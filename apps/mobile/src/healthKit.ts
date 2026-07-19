import { Platform } from "react-native";
import Constants from "expo-constants";
import { api } from "./api/client";

export async function syncHealthKit() {
  if (Platform.OS !== "ios") throw new Error("HealthKit 仅支持 iPhone。");
  if (Constants.appOwnership === "expo") throw new Error("Expo Go 不包含 HealthKit，请安装项目的 iOS Development Build。");
  const healthKit = await import("@kingstinct/react-native-healthkit");
  const quantity = healthKit.HKQuantityTypeIdentifier;
  const category = healthKit.HKCategoryTypeIdentifier;
  const readTypes = [
    quantity.height,
    quantity.bodyMass,
    quantity.bodyFatPercentage,
    quantity.restingHeartRate,
    quantity.heartRateVariabilitySDNN,
    category.sleepAnalysis,
  ] as const;
  if (!(await healthKit.isHealthDataAvailable())) throw new Error("当前设备无法使用 HealthKit。");
  await healthKit.requestAuthorization(readTypes, []);
  const startDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const options = { from: startDate, limit: 0, ascending: true } as const;
  const [height, weight, fat, resting, hrv, sleep] = await Promise.all([
    healthKit.queryQuantitySamples(quantity.height, options),
    healthKit.queryQuantitySamples(quantity.bodyMass, options),
    healthKit.queryQuantitySamples(quantity.bodyFatPercentage, options),
    healthKit.queryQuantitySamples(quantity.restingHeartRate, options),
    healthKit.queryQuantitySamples(quantity.heartRateVariabilitySDNN, options),
    healthKit.queryCategorySamples(category.sleepAnalysis, options),
  ]);
  const latest = <T>(items: readonly T[]) => items.at(-1);
  const profile = {
    ...(latest(height) ? { heightCm: latest(height)!.quantity * (latest(height)!.unit === "m" ? 100 : 1) } : {}),
    ...(latest(weight) ? { weightKg: latest(weight)!.quantity } : {}),
    ...(latest(fat) ? { bodyFatPercent: latest(fat)!.quantity * (latest(fat)!.unit === "%" ? 1 : 100) } : {}),
    ...(latest(resting) ? { restingHeartRateBpm: latest(resting)!.quantity } : {})
  };
  const payload = {
    profile,
    sleep: sleep.map((sample) => ({ date: sample.endDate.toISOString(), sleepStart: sample.startDate.toISOString(), sleepEnd: sample.endDate.toISOString(), durationMinutes: (sample.endDate.getTime() - sample.startDate.getTime()) / 60_000 })),
    recovery: hrv.map((sample) => ({ date: sample.endDate.toISOString(), hrvMs: sample.quantity, restingHeartRateBpm: latest(resting)?.quantity }))
  };
  return api.post<{ profileUpdated: boolean; sleepImported: number; recoveryImported: number }>("/sync/healthkit", payload);
}
