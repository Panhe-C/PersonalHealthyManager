import { NextResponse } from "next/server";
import { withUser } from "@/src/auth/api";
import { getAgentConversationForUser } from "@/src/services/agentConversations";

export const GET = withUser(async (user, _request: Request, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  const conversation = await getAgentConversationForUser(user.id, id);
  if (!conversation) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  return NextResponse.json(conversation);
});
