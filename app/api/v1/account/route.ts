import { NextResponse } from "next/server";
import { withUser } from "@/src/auth/api";
import { deleteUserAccount } from "@/src/services/accountService";

export const DELETE = withUser(async (user, request: Request) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Password is required", code: "password_required" }, { status: 400 });
  }

  const password = (body as Record<string, unknown>)?.password;
  if (typeof password !== "string" || !password) {
    return NextResponse.json({ error: "Password is required", code: "password_required" }, { status: 400 });
  }

  try {
    await deleteUserAccount(user.id, password);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Account deletion failed";
    const status = message === "Invalid password" ? 401 : 400;
    return NextResponse.json({ error: message, code: status === 401 ? "invalid_password" : "deletion_failed" }, { status });
  }

  // Sessions cascade with the User row, so the Bearer token is implicitly invalidated.
  return NextResponse.json({ ok: true });
});
