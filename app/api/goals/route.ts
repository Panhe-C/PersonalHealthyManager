import { NextResponse } from "next/server";
import { requireUser } from "@/src/auth/session";
import { createGoal, listGoals } from "@/src/services/goalService";

export async function GET() {
  const user = await requireUser();
  return NextResponse.json(await listGoals(user.id));
}

export async function POST(request: Request) {
  const user = await requireUser();
  const goal = await createGoal(user.id, await request.json());
  return NextResponse.json(goal, { status: 201 });
}
