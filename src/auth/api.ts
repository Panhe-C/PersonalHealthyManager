import type { User } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/auth/session";

type AuthenticatedHandler<TArgs extends unknown[]> = (user: User, ...args: TArgs) => Promise<Response>;

export function withUser<TArgs extends unknown[]>(handler: AuthenticatedHandler<TArgs>) {
  return async (...args: TArgs): Promise<Response> => {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return handler(user, ...args);
  };
}
