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
 * Send a push notification to all of a user's registered Expo tokens.
 */
export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; data?: Record<string, unknown> }
): Promise<{ attempted: number; sent: number; failed: number }> {
  const tokens = await listPushTokens(userId);
  if (tokens.length === 0) return { attempted: 0, sent: 0, failed: 0 };

  const expoTokens = tokens.filter((item) => /^(ExponentPushToken|ExpoPushToken)\[.+\]$/.test(item.token));
  if (expoTokens.length === 0) return { attempted: 0, sent: 0, failed: 0 };

  const accessToken = process.env.EXPO_PUSH_ACCESS_TOKEN?.trim();
  let sent = 0;
  let failed = 0;

  for (let index = 0; index < expoTokens.length; index += 100) {
    const batch = expoTokens.slice(index, index + 100);
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
      },
      body: JSON.stringify(batch.map((item) => ({ to: item.token, sound: "default", ...payload })))
    });
    if (!response.ok) throw new Error(`Expo push gateway returned HTTP ${response.status}`);
    const body = await response.json() as { data?: Array<{ status?: string; details?: { error?: string } }> };
    const tickets = body.data ?? [];
    sent += tickets.filter((ticket) => ticket.status === "ok").length;
    failed += batch.length - tickets.filter((ticket) => ticket.status === "ok").length;

    const staleIds = tickets.flatMap((ticket, ticketIndex) =>
      ticket.details?.error === "DeviceNotRegistered" ? [batch[ticketIndex]?.id] : []
    ).filter((id): id is string => Boolean(id));
    if (staleIds.length > 0) await prisma.pushToken.deleteMany({ where: { id: { in: staleIds }, userId } });
  }

  return { attempted: expoTokens.length, sent, failed };
}
