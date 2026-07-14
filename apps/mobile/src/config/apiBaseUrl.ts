export function resolveApiBaseUrl(runtimeUrl?: string, configuredUrl?: string): string {
  const candidate = runtimeUrl?.trim() || configuredUrl?.trim();
  if (!candidate) {
    throw new Error("Mobile API base URL is not configured.");
  }

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error("Mobile API base URL must be an absolute HTTP(S) URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Mobile API base URL must use HTTP or HTTPS.");
  }

  return url.origin;
}
