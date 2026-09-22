#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AUTOMATION_LABEL, createAutomationLaunchAgent } from "./automation-launchd-config.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const launchAgentsDirectory = path.join(os.homedir(), "Library", "LaunchAgents");
const logDirectory = path.join(os.homedir(), "Library", "Logs", "HealthyBodyManager");
const plistPath = path.join(launchAgentsDirectory, `${AUTOMATION_LABEL}.plist`);
const serviceTarget = `gui/${process.getuid()}/${AUTOMATION_LABEL}`;
const command = process.argv[2] || "status";

function launchctl(args, options = {}) {
  return execFileSync("launchctl", args, { encoding: "utf8", stdio: options.inherit ? "inherit" : "pipe" });
}

function pause(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function bootstrapWithRetry() {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      launchctl(["bootstrap", `gui/${process.getuid()}`, plistPath], { inherit: true });
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 4) pause(attempt * 500);
    }
  }
  throw lastError;
}

if (command === "install") {
  mkdirSync(launchAgentsDirectory, { recursive: true });
  mkdirSync(logDirectory, { recursive: true });
  const temporaryPath = `${plistPath}.tmp`;
  writeFileSync(temporaryPath, createAutomationLaunchAgent({ projectRoot, nodePath: process.execPath, logDirectory }), { mode: 0o600 });
  renameSync(temporaryPath, plistPath);
  try { launchctl(["bootout", serviceTarget]); } catch {}
  pause(300);
  bootstrapWithRetry();
  launchctl(["kickstart", "-k", serviceTarget], { inherit: true });
  console.log(`Installed and started ${AUTOMATION_LABEL}`);
} else if (command === "uninstall") {
  try { launchctl(["bootout", serviceTarget], { inherit: true }); } catch {}
  rmSync(plistPath, { force: true });
  console.log(`Uninstalled ${AUTOMATION_LABEL}`);
} else if (command === "status") {
  try {
    process.stdout.write(launchctl(["print", serviceTarget]));
  } catch {
    console.log(`${AUTOMATION_LABEL} is not installed or running.`);
    process.exitCode = 1;
  }
} else {
  console.error("Usage: npm run automation:service -- install|uninstall|status");
  process.exitCode = 2;
}
