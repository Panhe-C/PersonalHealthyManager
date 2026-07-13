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

export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type TokenPair = z.infer<typeof tokenPairSchema>;
export type RefreshRequest = z.infer<typeof refreshRequestSchema>;
export type RefreshResponse = z.infer<typeof refreshResponseSchema>;
