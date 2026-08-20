#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { webReleaseChecks } from "./release-web-config.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const privacyPolicy = readFileSync(path.join(projectRoot, "docs/privacy-policy.md"), "utf8");
const checks = webReleaseChecks(process.env, privacyPolicy);

for (const check of checks) console.log(`${check.ok ? "PASS" : "FAIL"}  ${check.message}`);
const failed = checks.filter((check) => !check.ok);
if (failed.length) {
  console.error(`Web release preflight failed: ${failed.length} item(s) need attention.`);
  process.exitCode = 1;
} else {
  console.log("Web release configuration preflight passed.");
}
