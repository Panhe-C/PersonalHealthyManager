import { createHash } from "node:crypto";
import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { sqliteHeaderIsValid } from "@/scripts/data-storage.mjs";

const execFile = promisify(execFileCallback);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function modeOf(filePath: string) {
  return stat(filePath).then((info) => info.mode & 0o777);
}

function sha256(filePath: string) {
  return readFile(filePath).then((contents) => createHash("sha256").update(contents).digest("hex"));
}

describe("data backup", () => {
  it("creates a valid, checksummed backup and a 0600 offsite copy", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "hbm-data-backup-"));
    const source = path.join(directory, "source.sqlite");
    const backupDir = path.join(directory, "backups");
    const offsiteDir = path.join(directory, "offsite");

    try {
      await execFile(process.execPath, ["scripts/data-backup.mjs", backupDir], {
        cwd: projectRoot,
        env: {
          ...process.env,
          DATABASE_URL: `file:${source}`,
          HBM_BACKUP_OFFSITE_DIR: offsiteDir
        }
      });

      const backupFiles = (await readdir(backupDir)).filter((name) => name.endsWith(".sqlite"));
      expect(backupFiles).toHaveLength(1);
      const backupName = backupFiles[0];
      const backupPath = path.join(backupDir, backupName);
      const manifestPath = `${backupPath}.json`;
      const offsitePath = path.join(offsiteDir, backupName);
      const offsiteManifestPath = `${offsitePath}.json`;
      const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

      expect(sqliteHeaderIsValid(backupPath)).toBe(true);
      expect(manifest.database).toBe(backupName);
      expect(manifest.sha256).toBe(await sha256(backupPath));
      expect(await modeOf(backupPath)).toBe(0o600);
      expect(await modeOf(manifestPath)).toBe(0o600);
      expect(await modeOf(offsitePath)).toBe(0o600);
      expect(await modeOf(offsiteManifestPath)).toBe(0o600);
      expect(await sha256(offsitePath)).toBe(manifest.sha256);
      expect(JSON.parse(await readFile(offsiteManifestPath, "utf8"))).toEqual(manifest);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
