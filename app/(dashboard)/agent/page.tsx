import { AgentPanel } from "@/components/AgentPanel";
import { requireUser } from "@/src/auth/session";
import { prisma } from "@/src/db/client";

export default async function AgentPage() {
  const user = await requireUser();
  const messages = await prisma.agentMessage.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    take: 50
  });

  return (
    <main className="page grid" style={{ gap: 20 }}>
      <div className="page-header">
        <div>
          <h1>Agent</h1>
          <p className="page-subtitle">Explain plans, check recovery, prepare calendar drafts, and route replanning requests.</p>
        </div>
      </div>
      <AgentPanel
        initialMessages={messages.map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content
        }))}
      />
    </main>
  );
}
