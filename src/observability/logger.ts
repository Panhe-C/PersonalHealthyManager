import { randomBytes } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogFields = Record<string, unknown>;

type RequestContext = {
  requestId: string;
  userId?: string;
};

const requestContext = new AsyncLocalStorage<RequestContext>();

const SENSITIVE_KEY =
  /^(password|passwordhash|currentpassword|newpassword|token|refreshtoken|accesstoken|authorization|apikey|encryptedapikey|secret|cookie|set-cookie|email|content|message|prompt|body|notes)$/i;

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const BEARER_PATTERN = /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi;
const LONG_HEX_PATTERN = /\b[a-f0-9]{32,}\b/gi;

/**
 * Redacts values that must never leave the process as plain text for a health
 * app: passwords, API keys, emails, conversation bodies, and long tokens.
 * Nested objects are walked; arrays keep their length but scrub each entry.
 */
export function redact(value: unknown, keyHint = ""): unknown {
  if (value == null) return value;

  if (typeof value === "string") {
    if (SENSITIVE_KEY.test(keyHint)) return "[redacted]";
    return value
      .replace(EMAIL_PATTERN, "[email]")
      .replace(BEARER_PATTERN, "Bearer [redacted]")
      .replace(LONG_HEX_PATTERN, "[token]");
  }

  if (typeof value === "number" || typeof value === "boolean") return value;

  if (Array.isArray(value)) {
    return value.map((entry) => redact(entry, keyHint));
  }

  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY.test(key) ? "[redacted]" : redact(entry, key);
    }
    return out;
  }

  return String(value);
}

export function createRequestId(): string {
  return randomBytes(8).toString("hex");
}

export function runWithRequestContext<T>(context: RequestContext, fn: () => T): T {
  return requestContext.run(context, fn);
}

export function getRequestId(): string | undefined {
  return requestContext.getStore()?.requestId;
}

function emit(level: LogLevel, message: string, fields?: LogFields) {
  const store = requestContext.getStore();
  const payload = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    requestId: store?.requestId,
    userId: store?.userId ? "[user]" : undefined,
    ...(fields ? (redact(fields) as LogFields) : {})
  };

  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);

  // Optional webhook sink for production error monitoring (Sentry Relay,
  // Better Stack, self-hosted collector). Never required for local use.
  if (level === "error") {
    void forwardError(payload);
  }
}

async function forwardError(payload: Record<string, unknown>): Promise<void> {
  const endpoint = process.env.HBM_ERROR_WEBHOOK_URL?.trim();
  if (!endpoint) return;

  try {
    await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(3_000)
    });
  } catch {
    // Swallow sink failures so logging never takes down a request.
  }
}

export const logger = {
  debug: (message: string, fields?: LogFields) => emit("debug", message, fields),
  info: (message: string, fields?: LogFields) => emit("info", message, fields),
  warn: (message: string, fields?: LogFields) => emit("warn", message, fields),
  error: (message: string, fields?: LogFields) => emit("error", message, fields)
};

/**
 * Capture an unexpected failure with a stable code, never the raw user payload.
 * Prefer this over `console.error(error)` so redaction stays consistent.
 */
export function captureError(code: string, error: unknown, fields?: LogFields): void {
  logger.error(code, {
    ...fields,
    err:
      error instanceof Error
        ? { name: error.name, message: redact(error.message) as string }
        : { message: String(error) }
  });
}
