import { randomBytes } from "node:crypto";
import { prisma } from "@/src/db/client";
import {
  writeCalendarDraft,
  type CalendarWriteDraft,
  type CalendarWriteResult
} from "@/src/providers/calendar-writeback";
import {
  buildFeishuAuthorizeUrl,
  createFeishuCalendarEvent,
  deleteFeishuCalendarEvent,
  exchangeFeishuCode,
  feishuOAuthConfigured,
  updateFeishuCalendarEvent,
  type FeishuCalendarTokens
} from "@/src/providers/feishu-calendar-oauth";
import { decryptSecret, encryptSecret } from "@/src/settings/crypto";
import { loadDataMcpConnection } from "@/src/settings/service";

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function decryptAuthField(
  auth: Record<string, unknown>,
  names: { encrypted: string; iv: string; tag: string }
): string | null {
  const encrypted = stringValue(auth[names.encrypted]);
  const iv = stringValue(auth[names.iv]);
  const tag = stringValue(auth[names.tag]);
  if (!encrypted || !iv || !tag) return null;
  try {
    return decryptSecret({ encryptedApiKey: encrypted, apiKeyIv: iv, apiKeyTag: tag });
  } catch {
    return null;
  }
}

/**
 * Reads per-user Feishu tokens off the calendar MCP connection when the user
 * has completed OAuth. Returns null when the connection still uses the shared
 * lark-cli identity (or nothing at all).
 */
export async function loadUserFeishuCalendarTokens(userId: string): Promise<FeishuCalendarTokens | null> {
  const connection = await loadDataMcpConnection(userId, "calendar");
  if (!connection || connection.auth.type !== "oauth2") return null;

  const auth = connection.auth as unknown as Record<string, unknown>;
  const accessToken = decryptAuthField(auth, {
    encrypted: "encryptedAccessToken",
    iv: "accessTokenIv",
    tag: "accessTokenTag"
  });
  if (!accessToken) return null;

  const calendarId =
    stringValue(auth.calendarId) || process.env.HBM_LARK_CALENDAR_ID?.trim() || "primary";

  return {
    accessToken,
    refreshToken:
      decryptAuthField(auth, {
        encrypted: "encryptedRefreshToken",
        iv: "refreshTokenIv",
        tag: "refreshTokenTag"
      }) || undefined,
    calendarId
  };
}

export async function writeCalendarDraftForUser(
  userId: string,
  draft: CalendarWriteDraft
): Promise<CalendarWriteResult> {
  const tokens = await loadUserFeishuCalendarTokens(userId);
  if (tokens) {
    if (draft.operation === "cancel") {
      if (!draft.externalEventId) throw new Error("Cancellation draft is missing an external event.");
      await deleteFeishuCalendarEvent(tokens, draft.externalEventId);
      return { externalEventId: null };
    }

    if (draft.externalEventId) {
      await updateFeishuCalendarEvent(tokens, {
        eventId: draft.externalEventId,
        summary: draft.title,
        description: draft.notes,
        startIso: draft.startsAt.toISOString(),
        endIso: draft.endsAt.toISOString()
      });
      return { externalEventId: draft.externalEventId };
    }

    const externalEventId = await createFeishuCalendarEvent(tokens, {
      summary: draft.title,
      description: draft.notes,
      startIso: draft.startsAt.toISOString(),
      endIso: draft.endsAt.toISOString()
    });
    return { externalEventId };
  }

  return writeCalendarDraft(draft);
}

export async function startFeishuCalendarOAuth(userId: string, origin: string): Promise<URL> {
  if (!feishuOAuthConfigured()) {
    throw new Error("Set HBM_FEISHU_APP_ID and HBM_FEISHU_APP_SECRET before connecting Feishu calendar.");
  }

  const state = randomBytes(16).toString("hex");
  const redirectUri = `${new URL(origin).origin}/api/settings/feishu/oauth/callback`;
  const record = await prisma.userSettings.findUnique({ where: { userId } });
  if (!record) throw new Error("Save settings before connecting Feishu calendar.");

  const connections = JSON.parse(record.dataMcpConnectionsJson) as Array<Record<string, unknown>>;
  const next = connections.map((item) => {
    if (item.id !== "calendar") return item;
    const auth = (item.auth as Record<string, unknown>) ?? {};
    return {
      ...item,
      auth: {
        ...auth,
        type: "oauth2",
        oauthState: state,
        oauthReturnOrigin: origin
      }
    };
  });

  await prisma.userSettings.update({
    where: { userId },
    data: { dataMcpConnectionsJson: JSON.stringify(next) }
  });

  return buildFeishuAuthorizeUrl({ redirectUri, state });
}

export async function completeFeishuCalendarOAuth(params: {
  code: string;
  state: string;
  origin: string;
}): Promise<{ userId: string }> {
  const settings = await prisma.userSettings.findMany();
  let matched: { userId: string; connections: Array<Record<string, unknown>> } | null = null;

  for (const record of settings) {
    const connections = JSON.parse(record.dataMcpConnectionsJson) as Array<Record<string, unknown>>;
    const calendar = connections.find((item) => item.id === "calendar");
    const auth = calendar?.auth as Record<string, unknown> | undefined;
    if (auth?.oauthState === params.state) {
      matched = { userId: record.userId, connections };
      break;
    }
  }

  if (!matched) throw new Error("Feishu OAuth state is not recognized or has expired.");

  const redirectUri = `${new URL(params.origin).origin}/api/settings/feishu/oauth/callback`;
  const tokens = await exchangeFeishuCode({ code: params.code, redirectUri });
  const access = encryptSecret(tokens.accessToken);
  const refresh = tokens.refreshToken ? encryptSecret(tokens.refreshToken) : null;

  const next = matched.connections.map((item) => {
    if (item.id !== "calendar") return item;
    const auth = (item.auth as Record<string, unknown>) ?? {};
    return {
      ...item,
      enabled: true,
      auth: {
        ...auth,
        type: "oauth2",
        encryptedAccessToken: access.encryptedApiKey,
        accessTokenIv: access.apiKeyIv,
        accessTokenTag: access.apiKeyTag,
        accessTokenHint: access.apiKeyHint,
        ...(refresh
          ? {
              encryptedRefreshToken: refresh.encryptedApiKey,
              refreshTokenIv: refresh.apiKeyIv,
              refreshTokenTag: refresh.apiKeyTag,
              refreshTokenHint: refresh.apiKeyHint
            }
          : {}),
        oauthState: undefined,
        calendarId: process.env.HBM_LARK_CALENDAR_ID?.trim() || "primary"
      }
    };
  });

  await prisma.userSettings.update({
    where: { userId: matched.userId },
    data: { dataMcpConnectionsJson: JSON.stringify(next) }
  });

  return { userId: matched.userId };
}

export { feishuOAuthConfigured };
