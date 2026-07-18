import { z } from "zod";
import { api } from "./client";

export const mobileSettingsSchema = z.object({
  modelProvider: z.string(),
  modelName: z.string(),
  modelBaseUrl: z.string(),
  hasApiKey: z.boolean(),
  apiKeyHint: z.string().nullable(),
  dataMcpConnections: z.array(
    z.object({
      id: z.enum(["coros", "calendar", "meal_menu"]),
      label: z.string(),
      enabled: z.boolean(),
      endpoint: z.string(),
      transport: z.enum(["http", "stdio"]).optional(),
      larkSessionHint: z.string().optional(),
      auth: z.object({
        type: z.enum(["none", "bearer", "api_key", "basic", "oauth2"]),
        tokenHint: z.string().optional(),
        apiKeyHint: z.string().optional(),
        passwordHint: z.string().optional(),
        accessTokenHint: z.string().optional(),
        expiresAt: z.string().optional()
      }).passthrough()
    }).passthrough()
  )
});

export type MobileSettings = z.infer<typeof mobileSettingsSchema>;
export type MobileMcpConnection = MobileSettings["dataMcpConnections"][number];

export function getSettings() {
  return api.get<MobileSettings>("/settings", mobileSettingsSchema);
}
