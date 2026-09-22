/**
 * Pure half of the COROS OAuth flow. Deliberately free of `expo-web-browser`,
 * which pulls in react-native and cannot be parsed by the test runner; the
 * browser session itself lives in corosOAuthSession.ts.
 */

/**
 * Must match the deep link the server callback redirects to, otherwise the
 * in-app browser will not recognise the end of the flow and stays open.
 */
export const COROS_OAUTH_RETURN_URL = "hbm://mcp-oauth";

export type CorosAuthOutcome =
  | { status: "connected" }
  | { status: "cancelled" }
  | { status: "failed"; message: string };

/**
 * React Native's URL polyfill is unreliable, so the callback's query string is
 * read by hand rather than through URLSearchParams.
 */
function readParam(url: string, key: string): string {
  const start = url.indexOf("?");
  if (start === -1) return "";

  const query = url.slice(start + 1).split("#")[0];
  for (const pair of query.split("&")) {
    if (!pair) continue;
    const eq = pair.indexOf("=");
    const name = eq === -1 ? pair : pair.slice(0, eq);
    if (decodeURIComponent(name) !== key) continue;
    return eq === -1 ? "" : decodeURIComponent(pair.slice(eq + 1).replace(/\+/g, " "));
  }

  return "";
}

export function interpretOAuthReturnUrl(url: string | undefined | null): CorosAuthOutcome {
  if (!url) return { status: "cancelled" };
  if (readParam(url, "auth") === "connected") return { status: "connected" };

  return { status: "failed", message: readParam(url, "error") || "COROS 授权未完成。" };
}
