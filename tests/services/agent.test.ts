import { describe, expect, it } from "vitest";
import { createAgentResponse } from "@/src/services/agent";

describe("agent response shell", () => {
  it("routes sleep-related questions to a conservative training explanation", () => {
    const response = createAgentResponse("我昨晚没睡好，今天还适合跑吗？");

    expect(response.intent).toBe("recovery_check");
    expect(response.message).toContain("recovery");
  });

  it("routes calendar write requests to confirmation flow", () => {
    const response = createAgentResponse("帮我把本周训练写入飞书日历");

    expect(response.intent).toBe("calendar_confirmation");
  });

  it("routes meal questions to menu advice", () => {
    const response = createAgentResponse("今天午餐这些菜怎么选？");

    expect(response.intent).toBe("menu_advice");
  });
});
