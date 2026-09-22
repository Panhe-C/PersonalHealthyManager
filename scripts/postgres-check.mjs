#!/usr/bin/env node
/**
 * Soft check that a Postgres target is reachable. Does not migrate schema —
 * see docs/postgres-migration.md for the full procedure.
 */
import { spawnSync } from "node:child_process";

const url = process.env.DATABASE_URL?.trim() || "";
const looksPostgres = url.startsWith("postgresql://") || url.startsWith("postgres://");

if (!looksPostgres) {
  console.log("SKIP  DATABASE_URL is not Postgres (current default is SQLite).");
  console.log("      Set DATABASE_URL=postgresql://hbm:hbm@localhost:5432/hbm?schema=public");
  console.log("      and `docker compose up -d postgres` when you are ready to migrate.");
  process.exit(0);
}

const result = spawnSync("docker", ["compose", "ps", "--status", "running", "postgres"], {
  encoding: "utf8"
});

if (result.status === 0 && result.stdout.includes("hbm-postgres")) {
  console.log("PASS  Postgres compose service appears to be running.");
} else {
  console.log("WARN  Could not confirm the compose postgres service is up.");
  console.log("      Run: docker compose up -d postgres");
}

console.log(`INFO  DATABASE_URL host looks like Postgres: ${url.replace(/:[^:@/]+@/, ":***@")}`);
console.log("Next: follow docs/postgres-migration.md — do not replay SQLite migrations.");
