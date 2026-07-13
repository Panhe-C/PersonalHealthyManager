import { NextResponse } from "next/server";
import { withUser } from "@/src/auth/api";
import { handleAgentMessage } from "@/src/services/agentOrchestration";

export const POST = withUser(async (user, request: Request) => {
  const body = await request.json().catch(() => null);
  const result = await handleAgentMessage(user.id, body);
  return NextResponse.json(result.body, { status: result.status });
});
