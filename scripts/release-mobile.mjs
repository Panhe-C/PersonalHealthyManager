#!/usr/bin/env node
import { mobileReleaseChecks } from "./release-mobile-config.mjs";

const checks = mobileReleaseChecks(process.env);
for (const check of checks) console.log(`${check.ok ? "PASS" : "FAIL"}  ${check.message}`);
const failed = checks.filter((check) => !check.ok);
if (failed.length) {
  console.error(`Mobile release preflight failed: ${failed.length} item(s) need attention.`);
  process.exitCode = 1;
} else {
  console.log("Mobile release configuration preflight passed.");
}
