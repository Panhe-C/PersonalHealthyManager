import { NextResponse } from "next/server";
import { withUser } from "@/src/auth/api";
import { createAgentConversation, listAgentConversations } from "@/src/services/agentConversations";

export const GET = withUser(async (user) => NextResponse.json(await listAgentConversations(user.id)));

export const POST = withUser(async (user) => NextResponse.json(await createAgentConversation(user.id), { status: 201 }));
