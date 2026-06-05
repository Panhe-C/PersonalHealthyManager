import { NextResponse } from "next/server";
import { withUser } from "@/src/auth/api";
import { testUserSettings } from "@/src/settings/service";

export const POST = withUser(async (user, request: Request) => {
  try {
    const body = await request.json();
    return NextResponse.json({ results: await testUserSettings(user.id, body.target) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Settings test failed" },
      { status: 400 }
    );
  }
});
