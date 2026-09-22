import { chmod, copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { quoteSqliteString, resolveSqlitePath, sha256, sqliteHeaderIsValid } from "./data-storage.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function main() {
  const databasePath = resolveSqlitePath(rootDir);
  const outputDir = path.resolve(process.argv[2] || path.join(rootDir, "backups"));
  await mkdir(outputDir, { recursive: true, mode: 0o700 });
  const outputPath = path.join(outputDir, `healthy-body-${timestamp()}.sqlite`);
  const prisma = new PrismaClient({ datasources: { db: { url: `file:${databasePath}` } } });

  try {
    await prisma.$executeRawUnsafe(`VACUUM INTO ${quoteSqliteString(outputPath)}`);
  } finally {
    await prisma.$disconnect();
  }

  if (!sqliteHeaderIsValid(outputPath)) throw new Error("Backup did not produce a valid SQLite database.");
  await chmod(outputPath, 0o600);
  const manifest = {
    version: 1,
    createdAt: new Date().toISOString(),
    database: path.basename(outputPath),
    sha256: sha256(outputPath)
  };
  const manifestPath = `${outputPath}.json`;
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  await chmod(manifestPath, 0o600);
  console.log(`Backup ready: ${outputPath}`);
  console.log(`SHA-256: ${manifest.sha256}`);

  // Optional offsite copy (another volume, rclone mount, NAS). Failures here
  // must not undo a successful local backup — they only surface as an error exit
  // so LaunchAgent/cron can alert.
  const offsiteDir = process.env.HBM_BACKUP_OFFSITE_DIR?.trim();
  if (offsiteDir) {
    await mkdir(offsiteDir, { recursive: true, mode: 0o700 });
    const offsiteDb = path.join(offsiteDir, path.basename(outputPath));
    const offsiteManifest = `${offsiteDb}.json`;
    await copyFile(outputPath, offsiteDb);
    await chmod(offsiteDb, 0o600);
    await copyFile(manifestPath, offsiteManifest);
    await chmod(offsiteManifest, 0o600);
    console.log(`Offsite copy: ${offsiteDb}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
