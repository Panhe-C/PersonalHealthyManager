import { NextResponse } from "next/server";
import { requireUser } from "@/src/auth/session";
import { generatePlanForUser } from "@/src/services/planService";

export async function POST(request: Request) {
  const user = await requireUser();
  const body = await request.json();
  const weekStart = new Date(body.weekStart);
  return NextResponse.json(await generatePlanForUser(user.id, weekStart));
}
