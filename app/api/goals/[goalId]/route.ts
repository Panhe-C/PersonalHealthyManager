import { NextResponse } from "next/server";
import { withUser } from "@/src/auth/api";
import { removeGoal, updateGoal } from "@/src/services/goalService";

type GoalRouteContext = {
  params: Promise<{
    goalId: string;
  }>;
};

export const PATCH = withUser(async (user, request: Request, context: GoalRouteContext) => {
  const { goalId } = await context.params;
  const goal = await updateGoal(user.id, goalId, await request.json());
  return NextResponse.json(goal);
});

export const DELETE = withUser(async (user, _request: Request, context: GoalRouteContext) => {
  const { goalId } = await context.params;
  await removeGoal(user.id, goalId);
  return NextResponse.json({ ok: true });
});
