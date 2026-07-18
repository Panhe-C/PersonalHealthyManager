import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export function readDatabaseUrl(rootDir, env = process.env) {
  if (env.DATABASE_URL) return env.DATABASE_URL;
  const envPath = path.join(rootDir, ".env");
  if (!existsSync(envPath)) return "file:./dev.db";
  const line = readFileSync(envPath, "utf8").split(/\r?\n/).find((item) => /^\s*DATABASE_URL\s*=/.test(item));
  if (!line) return "file:./dev.db";
  return line.slice(line.indexOf("=") + 1).trim().replace(/^(['"])(.*)\1$/, "$2");
}

export function resolveSqlitePath(rootDir, env = process.env) {
  const url = readDatabaseUrl(rootDir, env);
  if (!url.startsWith("file:")) throw new Error("Backup tools currently support SQLite DATABASE_URL values only.");
  const value = decodeURIComponent(url.slice("file:".length));
  return path.resolve(path.join(rootDir, "prisma"), value);
}

export function sqliteHeaderIsValid(filePath) {
  if (!existsSync(filePath)) return false;
  const header = readFileSync(filePath).subarray(0, 16).toString("utf8");
  return header === "SQLite format 3\u0000";
}

export function sha256(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

export function quoteSqliteString(value) {
  return `'${value.replaceAll("'", "''")}'`;
}
