import { NextResponse } from "next/server";
import { withUser } from "@/src/auth/api";
import { getTodayOverview } from "@/src/services/planQueryService";

export const GET = withUser(async (user) => {
  const overview = await getTodayOverview(user.id, user.timezone);
  return NextResponse.json(overview);
});
