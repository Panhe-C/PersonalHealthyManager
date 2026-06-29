import { NextResponse } from "next/server";
import { withUser } from "@/src/auth/api";
import { getActivePlan } from "@/src/services/planQueryService";

export const GET = withUser(async (user) => {
  const plan = await getActivePlan(user.id);
  return NextResponse.json(plan);
});
