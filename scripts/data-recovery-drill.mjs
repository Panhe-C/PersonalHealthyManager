import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { resolveSqlitePath, sha256, sqliteHeaderIsValid } from "./data-storage.mjs";

/**
 * Recovery drill: take a backup, verify checksum, restore into a temp copy of
 * the live DB path's sibling, and write a drill report. Does not overwrite the
 * live database unless --destructive is passed (still keeps a pre-restore rescue).
 */
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: rootDir, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(stderr || stdout || `exit ${code}`));
    });
  });
}

async function main() {
  const startedAt = Date.now();
  const destructive = process.argv.includes("--destructive");
  const reportDir = path.join(rootDir, "backups", "drill-reports");
  await mkdir(reportDir, { recursive: true });

  const scratch = await mkdtemp(path.join(os.tmpdir(), "hbm-drill-"));
  const backupDir = path.join(scratch, "backups");
  await mkdir(backupDir, { recursive: true });

  console.log("1/4 Taking a fresh backup…");
  await run(process.execPath, ["scripts/data-backup.mjs", backupDir]);
  const files = (await import("node:fs/promises")).readdir;
  const names = (await files(backupDir)).filter((name) => name.endsWith(".sqlite"));
  if (names.length !== 1) throw new Error("Expected exactly one backup file from the drill.");
  const backupPath = path.join(backupDir, names[0]);

  console.log("2/4 Verifying checksum…");
  if (!sqliteHeaderIsValid(backupPath)) throw new Error("Drill backup is not a valid SQLite file.");
  const manifest = JSON.parse(await readFile(`${backupPath}.json`, "utf8"));
  if (manifest.sha256 !== sha256(backupPath)) throw new Error("Drill backup checksum mismatch.");

  console.log("3/4 Restoring into an isolated copy…");
  const liveDb = resolveSqlitePath(rootDir);
  const isolatedTarget = path.join(scratch, "restored.sqlite");
  await copyFile(backupPath, isolatedTarget);
  if (!sqliteHeaderIsValid(isolatedTarget)) throw new Error("Isolated restore failed header check.");

  let liveRestored = false;
  if (destructive) {
    console.log("4/4 Destructive restore of the live database…");
    await run(process.execPath, ["scripts/data-restore.mjs", "--from", backupPath, "--confirm"]);
    liveRestored = true;
  } else {
    console.log("4/4 Skipping live restore (pass --destructive to exercise it).");
  }

  const elapsedMs = Date.now() - startedAt;
  const report = {
    version: 1,
    createdAt: new Date().toISOString(),
    elapsedMs,
    backupPath: path.basename(backupPath),
    sha256: manifest.sha256,
    isolatedRestoreOk: true,
    liveRestored,
    rpoNote: "Loss window is the time since the previous successful backup.",
    rtoNote: `This drill completed in ${Math.round(elapsedMs / 1000)}s on this host.`
  };
  const reportPath = path.join(reportDir, `drill-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  await rm(scratch, { recursive: true, force: true });

  console.log(`Recovery drill passed in ${elapsedMs}ms.`);
  console.log(`Report: ${reportPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
