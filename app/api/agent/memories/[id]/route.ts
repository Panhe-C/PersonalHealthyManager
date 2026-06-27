import { NextResponse } from "next/server";
import { withUser } from "@/src/auth/api";
import { deleteMemoryForUser, updateMemoryForUser } from "@/src/services/agentMemory/memoryService";

export const PATCH = withUser(
  async (user, request: Request, context: { params: Promise<{ id: string }> }) => {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const outcome = await updateMemoryForUser(user.id, id, {
      kind: body.kind !== undefined ? String(body.kind) : undefined,
      category: body.category !== undefined ? String(body.category) : undefined,
      content: body.content !== undefined ? String(body.content) : undefined
    });
    if (!outcome.ok) return NextResponse.json({ error: outcome.error }, { status: outcome.status });
    return NextResponse.json({ memory: outcome.memory });
  }
);

export const DELETE = withUser(
  async (user, _request: Request, context: { params: Promise<{ id: string }> }) => {
    const { id } = await context.params;
    const outcome = await deleteMemoryForUser(user.id, id);
    if (!outcome.ok) return NextResponse.json({ error: outcome.error }, { status: outcome.status });
    return NextResponse.json({ id, status: "deleted" });
  }
);
