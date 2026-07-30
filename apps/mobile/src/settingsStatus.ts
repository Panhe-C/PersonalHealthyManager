import type { MobileMcpConnection } from "./api/settings";
import { APP_TIME_ZONE } from "./ui/format";

/** Chinese date-time for authorization expiry, e.g. 2026年8月27日 08:23. */
function zhDateTime(date: Date): string {
  return date.toLocaleString("zh-CN", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

/**
 * Describes an OAuth2 connection without exposing an editable secret: there is
 * no token to type, only an authorization to run or renew.
 */
export function oauthConnectionDetail(connection: MobileMcpConnection, now = new Date()): string {
  const { auth } = connection;
  if (auth.type !== "oauth2") return "";
  if (!auth.accessTokenHint) return "尚未授权。";

  const expiresAt = auth.expiresAt ? new Date(auth.expiresAt) : null;
  if (!expiresAt || Number.isNaN(expiresAt.getTime())) {
    return `已授权 ${auth.accessTokenHint}`;
  }
  if (expiresAt.getTime() <= now.getTime()) {
    return `授权已于 ${zhDateTime(expiresAt)} 过期，请重新授权。`;
  }
  return `已授权 ${auth.accessTokenHint} · ${zhDateTime(expiresAt)} 到期`;
}

export function mcpConnectionStatus(connection: MobileMcpConnection | undefined) {
  if (!connection) return "未配置";
  if (!connection.enabled) return "已关闭";

  if (connection.id === "coros") {
    if (connection.auth.type === "oauth2" && connection.auth.accessTokenHint) return "已连接";
    return connection.endpoint ? "需登录" : "未配置";
  }

  if (connection.id === "meal_menu" && connection.transport === "stdio") {
    return connection.larkSessionHint ? "本地已连接" : "需要会话";
  }

  if (!connection.endpoint) return "未配置";
  if (connection.auth.type === "none") return "已配置";

  const hasCredential = Boolean(
    connection.auth.tokenHint ||
      connection.auth.apiKeyHint ||
      connection.auth.passwordHint ||
      connection.auth.accessTokenHint
  );
  return hasCredential ? "已连接" : "需登录";
}
