import { NextResponse } from "next/server";
import { requireUser } from "@/src/auth/session";
import { importCorosPayload } from "@/src/services/syncService";

export async function POST(request: Request) {
  const user = await requireUser();
  return NextResponse.json(await importCorosPayload(user.id, await request.json()));
}
