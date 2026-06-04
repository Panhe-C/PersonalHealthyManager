import { NextResponse } from "next/server";
import { withUser } from "@/src/auth/api";
import { createGoal, listGoals } from "@/src/services/goalService";

export const GET = withUser(async (user) => {
  return NextResponse.json(await listGoals(user.id));
});

export const POST = withUser(async (user, request: Request) => {
  const goal = await createGoal(user.id, await request.json());
  return NextResponse.json(goal, { status: 201 });
});
