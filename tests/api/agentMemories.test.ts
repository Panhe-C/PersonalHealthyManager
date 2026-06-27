import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/agent/memories/route";

vi.mock("@/src/auth/api", () => ({
  withUser:
    (handler: (...args: unknown[]) => Promise<Response>) =>
    (request: Request) =>
      handler({ id: "user-1", timezone: "Asia/Shanghai" }, request)
}));

vi.mock("@/src/services/agentMemory/memoryService", () => ({
  listMemoriesForUser: vi.fn(),
  createMemoryForUser: vi.fn()
}));

import { listMemoriesForUser, createMemoryForUser } from "@/src/services/agentMemory/memoryService";

describe("agent memories API", () => {
  beforeEach(() => vi.clearAllMocks());

  it("GET lists memories for the current user", async () => {
    vi.mocked(listMemoriesForUser).mockResolvedValue([
      {
        id: "mem-1",
        kind: "preference",
        category: "training",
        content: "习惯晨跑",
        source: "explicit",
        confidence: 1,
        status: "active",
        createdAt: "2026-06-27T00:00:00.000Z",
        updatedAt: "2026-06-27T00:00:00.000Z"
      }
    ]);

    const response = await GET(new Request("http://localhost/api/agent/memories"));
    expect(listMemoriesForUser).toHaveBeenCalledWith("user-1");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveLength(1);
    expect(body[0].content).toBe("习惯晨跑");
  });

  it("POST creates a memory and returns 201", async () => {
    vi.mocked(createMemoryForUser).mockResolvedValue({
      ok: true,
      memory: {
        id: "mem-2",
        kind: "fact",
        category: "nutrition",
        content: "对麸质过敏",
        source: "explicit",
        confidence: 1,
        status: "active",
        createdAt: "2026-06-27T00:00:00.000Z",
        updatedAt: "2026-06-27T00:00:00.000Z"
      }
    });

    const response = await POST(
      new Request("http://localhost/api/agent/memories", {
        method: "POST",
        body: JSON.stringify({ kind: "fact", category: "nutrition", content: "对麸质过敏" })
      })
    );

    expect(createMemoryForUser).toHaveBeenCalledWith("user-1", {
      kind: "fact",
      category: "nutrition",
      content: "对麸质过敏"
    });
    expect(response.status).toBe(201);
  });

  it("POST surfaces validation errors from the service", async () => {
    vi.mocked(createMemoryForUser).mockResolvedValue({
      ok: false,
      status: 400,
      error: "Invalid kind"
    });

    const response = await POST(
      new Request("http://localhost/api/agent/memories", {
        method: "POST",
        body: JSON.stringify({ kind: "bogus", category: "nutrition", content: "x" })
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid kind" });
  });
});
