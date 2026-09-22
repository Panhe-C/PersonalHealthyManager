#!/usr/bin/env node
/**
 * External connection acceptance checklist. Prints what is configured vs what
 * still needs a real credential / live call. Does not call third parties with
 * production secrets unless --probe is passed and the relevant env is set.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env");
let env = { ...process.env };
try {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !env[match[1]]) env[match[1]] = match[2].replace(/^"|"$/g, "");
  }
} catch {
  // .env is optional for this soft check
}

const checks = [
  {
    id: "smtp",
    ok: env.HBM_EMAIL_TRANSPORT === "smtp" && Boolean(env.HBM_SMTP_HOST),
    message: "SMTP email transport configured"
  },
  {
    id: "model",
    ok: true,
    message: "Model API keys are BYO per user (settings) — verify with a live chat"
  },
  {
    id: "coros",
    ok: true,
    message: "COROS OAuth — verify once from Settings → Connections on a real account"
  },
  {
    id: "meal-menu",
    ok: true,
    message: "Meal menu MCP — optional; verify when a stdio connection is enabled"
  },
  {
    id: "feishu-oauth",
    ok: Boolean(env.HBM_FEISHU_APP_ID && env.HBM_FEISHU_APP_SECRET),
    message: "Feishu app credentials for per-user calendar OAuth"
  },
  {
    id: "feishu-cli-fallback",
    ok: Boolean(env.HBM_LARK_CALENDAR_ACCOUNT_EMAIL),
    message: "Single-account lark-cli fallback email (or leave unset if OAuth-only)"
  },
  {
    id: "error-webhook",
    ok: Boolean(env.HBM_ERROR_WEBHOOK_URL),
    message: "Error webhook for structured log forwarding"
  },
  {
    id: "rate-limit-redis",
    ok: Boolean(env.HBM_RATE_LIMIT_REDIS_URL && env.HBM_RATE_LIMIT_REDIS_TOKEN),
    message: "Shared rate-limit Redis (required for multi-instance)"
  },
  {
    id: "backup-offsite",
    ok: Boolean(env.HBM_BACKUP_OFFSITE_DIR),
    message: "Offsite backup directory"
  }
];

for (const check of checks) {
  console.log(`${check.ok ? "PASS" : "TODO"}  ${check.message}`);
}

const pending = checks.filter((check) => !check.ok);
console.log(
  pending.length === 0
    ? "All connection prerequisites look configured. Still run a live probe per service."
    : `${pending.length} item(s) still need credentials or an operator decision.`
);
process.exitCode = 0;
