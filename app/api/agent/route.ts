import { NextResponse } from "next/server";
import { requireUser } from "@/src/auth/session";
import { prisma } from "@/src/db/client";
import { createAgentResponse } from "@/src/services/agent";

export async function POST(request: Request) {
  const user = await requireUser();
  const body = await request.json();
  const content = String(body.message ?? "").trim();

  if (!content) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  const response = createAgentResponse(content);

  await prisma.agentMessage.createMany({
    data: [
      { userId: user.id, role: "user", content, metadataJson: "{}" },
      {
        userId: user.id,
        role: "assistant",
        content: response.message,
        metadataJson: JSON.stringify({ intent: response.intent })
      }
    ]
  });

  return NextResponse.json(response);
}
