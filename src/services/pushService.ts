import { prisma } from "@/src/db/client";

/**
 * Idempotently register an Expo/APNs push token for a user. Re-registering the
 * same token refreshes `updatedAt` (and is a no-op thanks to the
 * `@@unique([userId, token])` constraint).
 */
export async function registerPushToken(userId: string, token: string, platform = "ios") {
  return prisma.pushToken.upsert({
    where: { userId_token: { userId, token } },
    update: { platform, updatedAt: new Date() },
    create: { userId, token, platform }
  });
}

export async function listPushTokens(userId: string) {
  return prisma.pushToken.findMany({ where: { userId } });
}

/**
 * Send a push notification to all of a user's registered tokens via Expo Push.
 * Stubbed here (no network in dev); wire `EXPO_PUSH_ACCESS_TOKEN` + the actual
 * fetch in production. Failures are swallowed and logged — push is best-effort.
 */
export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; data?: Record<string, unknown> }
): Promise<void> {
  const tokens = await listPushTokens(userId);
  if (tokens.length === 0) return;

  const expoTickets = tokens
    .map((t) => t.token)
    .filter((token) => token.startsWith("ExponentPushToken["));

  if (expoTickets.length === 0) return;

  // TODO(M4): enable when EXPO_PUSH_ACCESS_TOKEN is set in production.
  // await fetch("https://exp.host/--/api/v2/push/send", { ... })
  // eslint-disable-next-line no-console
  console.debug("[push] would send", payload, "to", expoTickets.length, "tokens");
}
