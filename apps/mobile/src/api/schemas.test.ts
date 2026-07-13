import { describe, expect, it } from "vitest";
import { conversationListResponseSchema } from "./schemas";

describe("mobile API schemas", () => {
  it("accepts the compact agent conversation summaries returned by the API", () => {
    const parsed = conversationListResponseSchema.parse([
      {
        id: "conversation-1",
        title: "分析我这周的运动数据",
        updatedAt: "2026-06-21T09:15:20.648Z"
      }
    ]);

    expect(parsed[0]).toEqual({
      id: "conversation-1",
      title: "分析我这周的运动数据",
      updatedAt: "2026-06-21T09:15:20.648Z"
    });
  });
});
