import { describe, expect, it } from "vitest";
import { createAutomationLaunchAgent } from "@/scripts/automation-launchd-config.mjs";

describe("automation LaunchAgent", () => {
  it("runs the watcher from the project without embedding secrets", () => {
    const plist = createAutomationLaunchAgent({
      projectRoot: "/Users/test/Healthy & Body",
      nodePath: "/opt/node/bin/node",
      logDirectory: "/Users/test/Library/Logs/HealthyBodyManager",
    });
    expect(plist).toContain("scripts/run-automations.ts");
    expect(plist).toContain("--watch");
    expect(plist).toContain("--env-file=/Users/test/Healthy &amp; Body/.env");
    expect(plist).toContain("/opt/node/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin");
    expect(plist).not.toContain("DATABASE_URL");
  });
});
