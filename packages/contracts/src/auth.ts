import { z } from "zod";

export const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const tokenPairSchema = z.object({
  ok: z.literal(true),
  accessToken: z.string(),
  refreshToken: z.string(),
  accessExpiresAt: z.string(),
  refreshExpiresAt: z.string()
});

export const refreshRequestSchema = z.object({
  refreshToken: z.string().min(1)
});

export const refreshResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  accessExpiresAt: z.string(),
  refreshExpiresAt: z.string()
});

export const logoutRequestSchema = z.object({
  refreshToken: z.string().optional()
});

export const okResponseSchema = z.object({ ok: z.literal(true) });

export const accountSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  timezone: z.string(),
  createdAt: z.string()
});

export const changePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(12).max(128)
});

export const deleteAccountRequestSchema = z.object({
  password: z.string().min(1)
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type TokenPair = z.infer<typeof tokenPairSchema>;
export type RefreshRequest = z.infer<typeof refreshRequestSchema>;
export type RefreshResponse = z.infer<typeof refreshResponseSchema>;
export type Account = z.infer<typeof accountSchema>;
export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>;
