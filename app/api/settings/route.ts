import { NextResponse } from "next/server";
import { withUser } from "@/src/auth/api";
import { loadUserSettings, saveUserSettings } from "@/src/settings/service";

export const GET = withUser(async (user) => NextResponse.json(await loadUserSettings(user.id)));

export const POST = withUser(async (user, request: Request) => {
  try {
    return NextResponse.json(await saveUserSettings(user.id, await request.json()));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Settings could not be saved" },
      { status: 400 }
    );
  }
});
