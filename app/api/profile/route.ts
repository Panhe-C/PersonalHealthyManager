import { NextResponse } from "next/server";
import { requireUser } from "@/src/auth/session";
import { getBodyProfile, upsertBodyProfile } from "@/src/services/profileService";

export async function GET() {
  const user = await requireUser();
  return NextResponse.json(await getBodyProfile(user.id));
}

export async function POST(request: Request) {
  const user = await requireUser();
  const profile = await upsertBodyProfile(user.id, await request.json());
  return NextResponse.json(profile);
}
