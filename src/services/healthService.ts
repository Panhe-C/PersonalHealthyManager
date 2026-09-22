import { prisma } from "@/src/db/client";

export async function getServiceHealth() {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      status: "ok" as const,
      database: "ok" as const,
      databaseLatencyMs: Date.now() - startedAt,
      uptimeSeconds: Math.floor(process.uptime()),
      version: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_SHA || "local",
      checkedAt: new Date().toISOString(),
    };
  } catch {
    return {
      status: "degraded" as const,
      database: "unavailable" as const,
      databaseLatencyMs: Date.now() - startedAt,
      uptimeSeconds: Math.floor(process.uptime()),
      version: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_SHA || "local",
      checkedAt: new Date().toISOString(),
    };
  }
}
