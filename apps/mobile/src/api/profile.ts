import { z } from "zod";
import { api } from "./client";

export const profileSchema = z.object({
  id: z.string(), userId: z.string(), heightCm: z.number(), weightKg: z.number(), bodyFatPercent: z.number().nullable(),
  birthday: z.string().nullable(), sex: z.string(), restingHeartRateBpm: z.number().int().nullable(), trainingExperience: z.string(),
  injuriesJson: z.string(), dietaryPreferencesJson: z.string(), trainingPreferencesJson: z.string()
}).passthrough();
export type MobileProfile = z.infer<typeof profileSchema>;

export function getProfile() { return api.get<MobileProfile | null>("/profile", profileSchema.nullable()); }
export function saveProfile(input: { heightCm: number; weightKg: number; bodyFatPercent?: number; sex: string; restingHeartRateBpm?: number; trainingExperience: string; injuries: string[]; dietaryPreferences: string[]; trainingPreferences: string[] }) {
  return api.post<MobileProfile>("/profile", input, profileSchema);
}
