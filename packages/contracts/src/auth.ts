import { z } from "zod";

/** Shared with change-password so both entry points enforce one policy. */
export const passwordSchema = z.string().min(12).max(128);

export const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const registerRequestSchema = z.object({
  email: z.string().email().max(254),
  password: passwordSchema,
  timezone: z.string().min(1).max(64).optional()
});

/**
 * Registration never reveals whether an address is already taken, so the
 * response carries no account data — only an acknowledgement that a message
 * was dispatched.
 */
export const registerResponseSchema = z.object({
  ok: z.literal(true),
  status: z.literal("verification_sent"),
  email: z.string().email()
});

export const verifyEmailRequestSchema = z.object({
  token: z.string().min(1)
});

export const verifyEmailResponseSchema = z.object({
  ok: z.literal(true),
  alreadyVerified: z.boolean()
});

export const resendVerificationRequestSchema = z.object({
  email: z.string().email().max(254)
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
  newPassword: passwordSchema
});

export const deleteAccountRequestSchema = z.object({
  password: z.string().min(1)
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type RegisterResponse = z.infer<typeof registerResponseSchema>;
export type VerifyEmailRequest = z.infer<typeof verifyEmailRequestSchema>;
export type VerifyEmailResponse = z.infer<typeof verifyEmailResponseSchema>;
export type ResendVerificationRequest = z.infer<typeof resendVerificationRequestSchema>;
export type TokenPair = z.infer<typeof tokenPairSchema>;
export type RefreshRequest = z.infer<typeof refreshRequestSchema>;
export type RefreshResponse = z.infer<typeof refreshResponseSchema>;
export type Account = z.infer<typeof accountSchema>;
export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>;
