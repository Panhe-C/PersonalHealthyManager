import { NextResponse } from "next/server";
import { withUser } from "@/src/auth/api";
import { prisma } from "@/src/db/client";
import { createAgentResponse, createAgentResponseForUser } from "@/src/services/agent";
import { buildAgentContext } from "@/src/services/agentContext";
import {
  getAgentConversationSummaryForUser,
  titleFromFirstMessage,
  touchAgentConversationAfterMessage
} from "@/src/services/agentConversations";

export const POST = withUser(async (user, request: Request) => {
  const body = await request.json();
  const content = String(body.message ?? "").trim();
  const conversationId = String(body.conversationId ?? "").trim();

  if (!content) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }
  if (!conversationId) {
    return NextResponse.json({ error: "Conversation is required" }, { status: 400 });
  }

  const conversation = await getAgentConversationSummaryForUser(user.id, conversationId);
  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const history = await prisma.agentMessage.findMany({
    where: { userId: user.id, conversationId },
    orderBy: { createdAt: "desc" },
    take: 8
  });
  const routed = createAgentResponse(content);
  const agentContext = await buildAgentContext(user.id, routed.intent, content);
  const response = await createAgentResponseForUser(
    user.id,
    content,
    history.reverse().map((message) => ({ role: message.role, content: message.content })),
    agentContext
  );

  await prisma.agentMessage.createMany({
    data: [
      { userId: user.id, conversationId, role: "user", content, metadataJson: "{}" },
      {
        userId: user.id,
        conversationId,
        role: "assistant",
        content: response.message,
        metadataJson: JSON.stringify({
          intent: response.intent,
          source: response.source,
          modelProvider: response.modelProvider,
          modelName: response.modelName,
          error: response.error,
          freshSync: agentContext.freshSync,
          contextSections: agentContext.sections.map((section) => section.title)
        })
      }
    ]
  });

  const nextTitle = conversation.title === "New conversation" && history.length === 0 ? titleFromFirstMessage(content) : undefined;
  const updatedConversation = await touchAgentConversationAfterMessage(user.id, conversationId, nextTitle);

  return NextResponse.json({ ...response, conversation: updatedConversation });
});
