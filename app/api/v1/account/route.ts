import { NextResponse } from "next/server";
import { changePasswordRequestSchema, deleteAccountRequestSchema } from "@hbm/contracts";
import { withUser } from "@/src/auth/api";
import { changeUserPassword, deleteUserAccount, getUserAccount } from "@/src/services/accountService";

export const GET = withUser(async (user) => {
  const account = await getUserAccount(user.id);
  return NextResponse.json({ ...account, createdAt: account.createdAt.toISOString() });
});

export const PATCH = withUser(async (user, request: Request) => {
  const parsed = changePasswordRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Current password and a new password of at least 12 characters are required", code: "invalid_password_change" },
      { status: 400 }
    );
  }

  try {
    await changeUserPassword(user.id, parsed.data.currentPassword, parsed.data.newPassword);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Password change failed";
    const status = message === "Invalid password" ? 401 : 400;
    return NextResponse.json({ error: message, code: status === 401 ? "invalid_password" : "password_change_failed" }, { status });
  }
});

export const DELETE = withUser(async (user, request: Request) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Password is required", code: "password_required" }, { status: 400 });
  }

  const parsed = deleteAccountRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Password is required", code: "password_required" }, { status: 400 });
  }

  try {
    await deleteUserAccount(user.id, parsed.data.password);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Account deletion failed";
    const status = message === "Invalid password" ? 401 : 400;
    return NextResponse.json({ error: message, code: status === 401 ? "invalid_password" : "deletion_failed" }, { status });
  }

  // Sessions cascade with the User row, so the Bearer token is implicitly invalidated.
  return NextResponse.json({ ok: true });
});
