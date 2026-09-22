import { describe, expect, it } from "vitest";
import { createBackupLaunchAgent, BACKUP_LABEL } from "@/scripts/backup-launchd-config.mjs";

describe("backup launch agent", () => {
  it("schedules backup + prune on an interval", () => {
    const plist = createBackupLaunchAgent({
      projectRoot: "/app",
      nodePath: "/usr/bin/node",
      logDirectory: "/logs",
      intervalSeconds: 3600
    });
    expect(plist).toContain(BACKUP_LABEL);
    expect(plist).toContain("<integer>3600</integer>");
    expect(plist).toContain("data-backup.mjs");
    expect(plist).toContain("data-backup-prune.mjs");
  });
});
