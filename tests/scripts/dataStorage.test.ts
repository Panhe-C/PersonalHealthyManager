import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { quoteSqliteString, resolveSqlitePath, sqliteHeaderIsValid } from "@/scripts/data-storage.mjs";

describe("data storage scripts", () => {
  it("resolves Prisma-relative SQLite paths", () => {
    expect(resolveSqlitePath("/repo", { DATABASE_URL: "file:./personal.db" })).toBe("/repo/prisma/personal.db");
  });

  it("preserves absolute SQLite paths used by persistent production volumes", () => {
    expect(resolveSqlitePath("/app", { DATABASE_URL: "file:/data/healthy-body.sqlite" })).toBe("/data/healthy-body.sqlite");
  });

  it("rejects non-SQLite databases", () => {
    expect(() => resolveSqlitePath("/repo", { DATABASE_URL: "postgresql://localhost/db" })).toThrow("SQLite");
  });

  it("validates the SQLite file header", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "hbm-backup-test-"));
    const valid = path.join(directory, "valid.sqlite");
    const invalid = path.join(directory, "invalid.sqlite");
    writeFileSync(valid, Buffer.from("SQLite format 3\u0000payload"));
    writeFileSync(invalid, "not sqlite");
    expect(sqliteHeaderIsValid(valid)).toBe(true);
    expect(sqliteHeaderIsValid(invalid)).toBe(false);
  });

  it("quotes SQLite string values safely", () => {
    expect(quoteSqliteString("/tmp/user's.sqlite")).toBe("'/tmp/user''s.sqlite'");
  });
});
