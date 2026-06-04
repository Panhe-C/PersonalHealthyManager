import { NextResponse } from "next/server";
import { withUser } from "@/src/auth/api";
import { importCorosPayload } from "@/src/services/syncService";

export const POST = withUser(async (user, request: Request) => {
  return NextResponse.json(await importCorosPayload(user.id, await request.json()));
});
