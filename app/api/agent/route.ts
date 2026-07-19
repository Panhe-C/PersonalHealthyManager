import { NextResponse } from "next/server";
import { withUser } from "@/src/auth/api";
import { handleAgentMessage } from "@/src/services/agentOrchestration";
import { consumeRateLimit, rateLimitHeaders } from "@/src/security/rateLimit";

export const POST = withUser(async (user, request: Request) => {
  const limit = consumeRateLimit({ key: `agent:${user.id}`, limit: 30, windowMs: 60_000 });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many agent requests", code: "rate_limited" },
      { status: 429, headers: rateLimitHeaders(limit) },
    );
  }
  const body = await request.json().catch(() => null);
  const result = await handleAgentMessage(user.id, body);
  return NextResponse.json(result.body, { status: result.status, headers: rateLimitHeaders(limit) });
});
