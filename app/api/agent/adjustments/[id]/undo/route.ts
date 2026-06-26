import { NextResponse } from "next/server";
import { withUser } from "@/src/auth/api";
import { undoAgentAdjustment } from "@/src/services/agentActions/undo";

export const POST = withUser(
  async (user, _request: Request, context: { params: Promise<{ id: string }> }) => {
    const { id } = await context.params;
    const outcome = await undoAgentAdjustment(user.id, id);
    if (!outcome.ok) {
      return NextResponse.json({ error: outcome.error }, { status: outcome.status });
    }
    return NextResponse.json({ id, undoneAt: new Date().toISOString() });
  }
);
