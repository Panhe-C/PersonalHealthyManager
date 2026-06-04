import { NextResponse } from "next/server";
import { withUser } from "@/src/auth/api";
import { importCalendarPayload } from "@/src/services/syncService";

export const POST = withUser(async (user, request: Request) => {
  return NextResponse.json(await importCalendarPayload(user.id, await request.json()));
});
