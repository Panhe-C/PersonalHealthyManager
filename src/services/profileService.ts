import { prisma } from "@/src/db/client";
import { bodyProfileSchema } from "@/src/domain/validation";

export function parseBodyProfileInput(input: unknown) {
  return bodyProfileSchema.parse(input);
}

export async function upsertBodyProfile(userId: string, input: unknown) {
  const profile = parseBodyProfileInput(input);
  const data = {
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
    bodyFatPercent: profile.bodyFatPercent,
    birthday: profile.birthday ? new Date(profile.birthday) : undefined,
    sex: profile.sex,
    restingHeartRateBpm: profile.restingHeartRateBpm,
    trainingExperience: profile.trainingExperience,
    injuriesJson: JSON.stringify(profile.injuries),
    dietaryPreferencesJson: JSON.stringify(profile.dietaryPreferences),
    trainingPreferencesJson: JSON.stringify(profile.trainingPreferences)
  };

  return prisma.bodyProfile.upsert({
    where: { userId },
    update: data,
    create: {
      userId,
      ...data
    }
  });
}

export async function getBodyProfile(userId: string) {
  return prisma.bodyProfile.findUnique({ where: { userId } });
}
