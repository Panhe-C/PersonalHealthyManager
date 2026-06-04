import { NextResponse } from "next/server";
import { withUser } from "@/src/auth/api";
import { getBodyProfile, upsertBodyProfile } from "@/src/services/profileService";

export const GET = withUser(async (user) => {
  return NextResponse.json(await getBodyProfile(user.id));
});

export const POST = withUser(async (user, request: Request) => {
  const profile = await upsertBodyProfile(user.id, await request.json());
  return NextResponse.json(profile);
});
