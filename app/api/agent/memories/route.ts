import { NextResponse } from "next/server";
import { withUser } from "@/src/auth/api";
import {
  createMemoryForUser,
  listMemoriesForUser
} from "@/src/services/agentMemory/memoryService";

export const GET = withUser(async (user) => NextResponse.json(await listMemoriesForUser(user.id)));

export const POST = withUser(async (user, request: Request) => {
  const body = await request.json().catch(() => ({}));
  const outcome = await createMemoryForUser(user.id, {
    kind: String(body.kind ?? ""),
    category: String(body.category ?? ""),
    content: String(body.content ?? "")
  });
  if (!outcome.ok) return NextResponse.json({ error: outcome.error }, { status: outcome.status });
  return NextResponse.json({ memory: outcome.memory }, { status: 201 });
});
