import * as WebBrowser from "expo-web-browser";
import { createOAuthAuthorizationUrl, prepareCorosConnection, type CorosRegion } from "./api/settings";
import { COROS_OAUTH_RETURN_URL, interpretOAuthReturnUrl, type CorosAuthOutcome } from "./corosOAuth";

/**
 * Pins the region, asks the authenticated API to prepare OAuth state and PKCE,
 * then opens the COROS authorization URL directly. The browser closes itself
 * when the server callback redirects to COROS_OAUTH_RETURN_URL.
 */
export async function runCorosOAuth(region: CorosRegion): Promise<CorosAuthOutcome> {
  await prepareCorosConnection(region);
  const { url } = await createOAuthAuthorizationUrl("coros");

  const result = await WebBrowser.openAuthSessionAsync(url, COROS_OAUTH_RETURN_URL);
  if (result.type !== "success") return { status: "cancelled" };

  return interpretOAuthReturnUrl(result.url);
}
