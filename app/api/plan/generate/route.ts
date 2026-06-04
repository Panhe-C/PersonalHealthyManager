import { NextResponse } from "next/server";
import { withUser } from "@/src/auth/api";
import { generatePlanForUser } from "@/src/services/planService";

export const POST = withUser(async (user, request: Request) => {
  const body = await request.json();
  const weekStart = new Date(body.weekStart);
  return NextResponse.json(await generatePlanForUser(user.id, weekStart));
});
