import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/src/db/client";
import { getServiceHealth } from "@/src/services/healthService";

vi.mock("@/src/db/client", () => ({ prisma: { $queryRaw: vi.fn() } }));

describe("service health", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reports a healthy database", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ 1: 1 }]);
    await expect(getServiceHealth()).resolves.toMatchObject({ status: "ok", database: "ok" });
  });

  it("degrades without exposing database errors", async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error("secret connection string"));
    const result = await getServiceHealth();
    expect(result).toMatchObject({ status: "degraded", database: "unavailable" });
    expect(JSON.stringify(result)).not.toContain("secret connection string");
  });
});
