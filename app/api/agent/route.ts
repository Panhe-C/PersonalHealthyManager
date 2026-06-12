import { NextResponse } from "next/server";
import { withUser } from "@/src/auth/api";
import { prisma } from "@/src/db/client";
import { createAgentResponseForUser } from "@/src/services/agent";

export const POST = withUser(async (user, request: Request) => {
  const body = await request.json();
  const content = String(body.message ?? "").trim();

  if (!content) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  const history = await prisma.agentMessage.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 8
  });
  const response = await createAgentResponseForUser(
    user.id,
    content,
    history.reverse().map((message) => ({ role: message.role, content: message.content }))
  );

  await prisma.agentMessage.createMany({
    data: [
      { userId: user.id, role: "user", content, metadataJson: "{}" },
      {
        userId: user.id,
        role: "assistant",
        content: response.message,
        metadataJson: JSON.stringify({
          intent: response.intent,
          source: response.source,
          modelProvider: response.modelProvider,
          modelName: response.modelName,
          error: response.error
        })
      }
    ]
  });

  return NextResponse.json(response);
});
