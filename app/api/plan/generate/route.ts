import { NextResponse } from "next/server";
import { withUser } from "@/src/auth/api";
import { isWeekStartInTimezone, planGenerationSchema } from "@/src/domain/validation";
import { generatePlanForUser, PlanPreconditionError } from "@/src/services/planService";

export const POST = withUser(async (user, request: Request) => {
  const parsed = planGenerationSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid week start" }, { status: 400 });
  }

  const weekStart = new Date(parsed.data.weekStart);
  if (!isWeekStartInTimezone(weekStart, user.timezone)) {
    return NextResponse.json({ error: "Week start must be Monday midnight in your timezone" }, { status: 400 });
  }

  try {
    return NextResponse.json(await generatePlanForUser(user.id, weekStart));
  } catch (error) {
    if (error instanceof PlanPreconditionError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 409 });
    }
    throw error;
  }
});
