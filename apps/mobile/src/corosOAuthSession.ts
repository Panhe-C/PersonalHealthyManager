import * as WebBrowser from "expo-web-browser";
import { createOAuthHandoffUrl, prepareCorosConnection, type CorosRegion } from "./api/settings";
import { COROS_OAUTH_RETURN_URL, interpretOAuthReturnUrl, type CorosAuthOutcome } from "./corosOAuth";

/**
 * Pins the region, trades the app's Bearer session for a single-use handoff
 * token, and hands the resulting URL to the system browser. The browser closes
 * itself when the server callback redirects to COROS_OAUTH_RETURN_URL.
 */
export async function runCorosOAuth(region: CorosRegion): Promise<CorosAuthOutcome> {
  await prepareCorosConnection(region);
  const { url } = await createOAuthHandoffUrl("coros");

  const result = await WebBrowser.openAuthSessionAsync(url, COROS_OAUTH_RETURN_URL);
  if (result.type !== "success") return { status: "cancelled" };

  return interpretOAuthReturnUrl(result.url);
}
