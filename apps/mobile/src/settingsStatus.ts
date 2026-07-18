import type { MobileMcpConnection } from "./api/settings";

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
