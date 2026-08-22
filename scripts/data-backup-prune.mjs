import { readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Prunes SQLite backups older than HBM_BACKUP_RETENTION_DAYS (default 14).
 * Keeps the matching .json manifests in lockstep with the .sqlite files.
 */
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function retentionDays() {
  const raw = process.env.HBM_BACKUP_RETENTION_DAYS?.trim();
  const parsed = raw ? Number(raw) : 14;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 14;
}

async function main() {
  const backupDir = path.resolve(process.argv[2] || path.join(rootDir, "backups"));
  const cutoff = Date.now() - retentionDays() * 24 * 60 * 60 * 1000;
  let removed = 0;

  let entries;
  try {
    entries = await readdir(backupDir);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      console.log(`No backup directory at ${backupDir}`);
      return;
    }
    throw error;
  }

  for (const name of entries) {
    if (!name.endsWith(".sqlite") && !name.endsWith(".sqlite.json")) continue;
    // Manifests are named backup.sqlite.json — handle both.
    const filePath = path.join(backupDir, name);
    const info = await stat(filePath);
    if (info.mtimeMs > cutoff) continue;
    await rm(filePath, { force: true });
    removed += 1;
    console.log(`Removed expired backup: ${filePath}`);
  }

  console.log(`Pruned ${removed} file(s); retention=${retentionDays()} day(s).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
