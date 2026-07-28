export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export type EmailTransport = "console" | "smtp";

export type SentEmail = EmailMessage & { sentAt: Date };

const globalState = globalThis as typeof globalThis & {
  __hbmSentEmails?: SentEmail[];
};

const sentEmails = globalState.__hbmSentEmails ?? [];
globalState.__hbmSentEmails = sentEmails;

export function resolveTransport(): EmailTransport {
  const configured = process.env.HBM_EMAIL_TRANSPORT?.trim().toLowerCase();
  if (configured === "smtp" || configured === "console") return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error("HBM_EMAIL_TRANSPORT must be set to \"smtp\" in production");
  }
  return "console";
}

export function resolveFromAddress(): string {
  const configured = process.env.HBM_EMAIL_FROM?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error("HBM_EMAIL_FROM must be configured in production");
  }
  return "Healthy Body Manager <no-reply@localhost>";
}

/**
 * Base URL used to build links that land in a user's inbox. Requests cannot be
 * trusted to supply it (Host headers are attacker-controlled), so it is read
 * from configuration only.
 */
export function resolveAppBaseUrl(): string {
  const configured = process.env.HBM_APP_BASE_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error("HBM_APP_BASE_URL must be configured in production");
  }
  return "http://localhost:3000";
}

function requiredSmtp(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required when HBM_EMAIL_TRANSPORT=smtp`);
  return value;
}

async function sendViaSmtp(message: EmailMessage): Promise<void> {
  const host = requiredSmtp("HBM_SMTP_HOST");
  const port = Number(process.env.HBM_SMTP_PORT?.trim() || "587");
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error("HBM_SMTP_PORT must be a valid port number");
  }
  const user = process.env.HBM_SMTP_USER?.trim();
  const pass = process.env.HBM_SMTP_PASSWORD;

  // Imported lazily so deployments using the console transport (and the test
  // suite) do not need the dependency resolved at module load.
  const { createTransport } = await import("nodemailer");
  const transporter = createTransport({
    host,
    port,
    secure: process.env.HBM_SMTP_SECURE?.trim() === "true" || port === 465,
    auth: user ? { user, pass } : undefined
  });

  await transporter.sendMail({
    from: resolveFromAddress(),
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html
  });
}

function sendViaConsole(message: EmailMessage): void {
  sentEmails.push({ ...message, sentAt: new Date() });
  console.info(
    [
      "",
      "──────── outgoing email (console transport) ────────",
      `to:      ${message.to}`,
      `subject: ${message.subject}`,
      "",
      message.text,
      "────────────────────────────────────────────────────",
      ""
    ].join("\n")
  );
}

export async function sendEmail(message: EmailMessage): Promise<void> {
  if (resolveTransport() === "smtp") {
    await sendViaSmtp(message);
    return;
  }
  sendViaConsole(message);
}

/** Console-transport outbox, used by local development and tests. */
export function readSentEmails(): readonly SentEmail[] {
  return sentEmails;
}

export function clearSentEmails(): void {
  sentEmails.length = 0;
}
