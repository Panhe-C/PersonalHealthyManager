/**
 * Per-user Feishu calendar OAuth (tenant_access_token / user_access_token).
 *
 * The lark-cli path writes every event to the deployer's calendar. This module
 * is the replacement: once a user completes OAuth and we store their tokens on
 * the calendar MCP connection, write-back uses the Open API against *their*
 * calendar_id instead of the shared CLI identity.
 *
 * Requires a Feishu/Lark app with calendar scopes. Without
 * HBM_FEISHU_APP_ID / HBM_FEISHU_APP_SECRET the OAuth start URL cannot be built
 * and callers should keep the existing fail-closed single-account guard.
 */

export type FeishuCalendarTokens = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  calendarId: string;
};

export type FeishuCalendarEventInput = {
  summary: string;
  description: string;
  startIso: string;
  endIso: string;
  eventId?: string | null;
};

function requireAppCredentials() {
  const appId = process.env.HBM_FEISHU_APP_ID?.trim();
  const appSecret = process.env.HBM_FEISHU_APP_SECRET?.trim();
  if (!appId || !appSecret) {
    throw new Error(
      "Feishu calendar OAuth is not configured. Set HBM_FEISHU_APP_ID and HBM_FEISHU_APP_SECRET, or keep using the single-account lark-cli path."
    );
  }
  return { appId, appSecret };
}

export function feishuOAuthConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.HBM_FEISHU_APP_ID?.trim() && env.HBM_FEISHU_APP_SECRET?.trim());
}

export function buildFeishuAuthorizeUrl(params: {
  redirectUri: string;
  state: string;
  scopes?: string;
}): URL {
  const { appId } = requireAppCredentials();
  const url = new URL("https://open.feishu.cn/open-apis/authen/v1/authorize");
  url.searchParams.set("app_id", appId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("state", params.state);
  url.searchParams.set(
    "scope",
    params.scopes || "calendar:calendar calendar:calendar.event:create calendar:calendar.event:update calendar:calendar.event:delete"
  );
  return url;
}

export async function exchangeFeishuCode(params: {
  code: string;
  redirectUri: string;
}): Promise<{ accessToken: string; refreshToken?: string; expiresIn?: number }> {
  const { appId, appSecret } = requireAppCredentials();
  const response = await fetch("https://open.feishu.cn/open-apis/authen/v2/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: appId,
      client_secret: appSecret,
      code: params.code,
      redirect_uri: params.redirectUri
    }),
    signal: AbortSignal.timeout(15_000)
  });
  const body = (await response.json()) as {
    code?: number | string;
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    msg?: string;
    error?: string;
    error_description?: string;
  };
  // The v2 token endpoint omits `code` on success entirely; only treat it as a
  // failure when the field is present and non-zero (some responses send "0").
  const hasErrorCode = body.code !== undefined && String(body.code) !== "0";
  if (!response.ok || hasErrorCode || !body.access_token) {
    throw new Error(body.error_description || body.msg || body.error || "Feishu OAuth token exchange failed");
  }
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresIn: body.expires_in
  };
}

async function feishuRequest(
  accessToken: string,
  method: string,
  path: string,
  body?: unknown
): Promise<unknown> {
  const response = await fetch(`https://open.feishu.cn/open-apis${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000)
  });
  const payload = await response.json();
  if (!response.ok || (payload && typeof payload === "object" && "code" in payload && payload.code !== 0)) {
    const message =
      payload && typeof payload === "object" && "msg" in payload ? String(payload.msg) : "Feishu calendar API failed";
    throw new Error(message);
  }
  return payload;
}

export async function createFeishuCalendarEvent(
  tokens: FeishuCalendarTokens,
  input: FeishuCalendarEventInput
): Promise<string> {
  const payload = (await feishuRequest(tokens.accessToken, "POST", `/calendar/v4/calendars/${encodeURIComponent(tokens.calendarId)}/events`, {
    summary: input.summary,
    description: input.description,
    start_time: { timestamp: String(Math.floor(new Date(input.startIso).getTime() / 1000)) },
    end_time: { timestamp: String(Math.floor(new Date(input.endIso).getTime() / 1000)) }
  })) as { data?: { event?: { event_id?: string } } };
  const eventId = payload.data?.event?.event_id;
  if (!eventId) throw new Error("Feishu create event response did not include an event ID.");
  return eventId;
}

export async function updateFeishuCalendarEvent(
  tokens: FeishuCalendarTokens,
  input: FeishuCalendarEventInput & { eventId: string }
): Promise<void> {
  await feishuRequest(
    tokens.accessToken,
    "PATCH",
    `/calendar/v4/calendars/${encodeURIComponent(tokens.calendarId)}/events/${encodeURIComponent(input.eventId)}`,
    {
      summary: input.summary,
      description: input.description,
      start_time: { timestamp: String(Math.floor(new Date(input.startIso).getTime() / 1000)) },
      end_time: { timestamp: String(Math.floor(new Date(input.endIso).getTime() / 1000)) }
    }
  );
}

export async function deleteFeishuCalendarEvent(
  tokens: FeishuCalendarTokens,
  eventId: string
): Promise<void> {
  await feishuRequest(
    tokens.accessToken,
    "DELETE",
    `/calendar/v4/calendars/${encodeURIComponent(tokens.calendarId)}/events/${encodeURIComponent(eventId)}?need_notification=true`
  );
}
