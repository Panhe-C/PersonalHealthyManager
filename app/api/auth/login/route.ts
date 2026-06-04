import { NextResponse } from "next/server";
import { verifyPassword } from "@/src/auth/password";
import { createSession } from "@/src/auth/session";
import { prisma } from "@/src/db/client";

const INVALID_CREDENTIALS = "Invalid email or password";

function invalidCredentialsResponse() {
  return NextResponse.json({ error: INVALID_CREDENTIALS }, { status: 401 });
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return invalidCredentialsResponse();
  }

  if (!body || typeof body !== "object") {
    return invalidCredentialsResponse();
  }

  const credentials = body as Record<string, unknown>;
  const email = typeof credentials.email === "string" ? credentials.email.trim().toLowerCase() : "";
  const password = typeof credentials.password === "string" ? credentials.password : "";

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return invalidCredentialsResponse();
  }

  await createSession(user.id);
  return NextResponse.json({ ok: true });
}
