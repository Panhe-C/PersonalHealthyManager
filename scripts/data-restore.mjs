import { copyFile, mkdir, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveSqlitePath, sha256, sqliteHeaderIsValid } from "./data-storage.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function verifyManifest(source) {
  try {
    const manifest = JSON.parse(await readFile(`${source}.json`, "utf8"));
    if (manifest.sha256 !== sha256(source)) throw new Error("Backup checksum does not match its manifest.");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return;
    throw error;
  }
}

async function main() {
  const sourceArg = argument("--from");
  if (!sourceArg || !process.argv.includes("--confirm")) {
    throw new Error("Usage: npm run data:restore -- --from <backup.sqlite> --confirm");
  }
  const source = path.resolve(sourceArg);
  const target = resolveSqlitePath(rootDir);
  if (source === target) throw new Error("Backup source and active database must be different files.");
  if (!sqliteHeaderIsValid(source)) throw new Error("Backup is not a valid SQLite database.");
  await verifyManifest(source);

  const rescueDir = path.join(rootDir, "backups", `pre-restore-${new Date().toISOString().replace(/[:.]/g, "-")}`);
  await mkdir(rescueDir, { recursive: true });
  if (sqliteHeaderIsValid(target)) await copyFile(target, path.join(rescueDir, path.basename(target)));

  const temporary = `${target}.restore-${process.pid}`;
  await copyFile(source, temporary);
  await rename(temporary, target);
  await Promise.all([rm(`${target}-wal`, { force: true }), rm(`${target}-shm`, { force: true }), rm(`${target}-journal`, { force: true })]);
  console.log(`Database restored from: ${source}`);
  console.log(`Previous database retained in: ${rescueDir}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
