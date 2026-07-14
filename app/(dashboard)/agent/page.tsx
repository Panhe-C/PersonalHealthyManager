import { AgentPanel } from "@/components/AgentPanel";
import { requireUser } from "@/src/auth/session";
import { prisma } from "@/src/db/client";

export default async function AgentPage() {
  const user = await requireUser();
  let conversations = await prisma.agentConversation.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    take: 30,
    select: { id: true, title: true, updatedAt: true }
  });

  if (conversations.length === 0) {
    const created = await prisma.agentConversation.create({
      data: { userId: user.id, title: "New conversation" },
      select: { id: true, title: true, updatedAt: true }
    });
    conversations = [created];
  }

  const selectedConversation = conversations[0];
  const messages = await prisma.agentMessage.findMany({
    where: { userId: user.id, conversationId: selectedConversation.id },
    orderBy: { createdAt: "asc" },
    take: 100
  });

  return (
    <main className="agent-page">
      <AgentPanel
        initialConversations={conversations.map((conversation) => ({
          id: conversation.id,
          title: conversation.title,
          updatedAt: conversation.updatedAt.toISOString()
        }))}
        initialConversationId={selectedConversation.id}
        initialMessages={messages.map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content
        }))}
      />
    </main>
  );
}
