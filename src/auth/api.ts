import type { User } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/auth/session";
import { createRequestId, runWithRequestContext } from "@/src/observability/logger";

type AuthenticatedHandler<TArgs extends unknown[]> = (user: User, ...args: TArgs) => Promise<Response>;

/**
 * Resolves the current user and runs the handler inside a request-scoped
 * logging context so structured logs for this call share one requestId.
 */
export function withUser<TArgs extends unknown[]>(handler: AuthenticatedHandler<TArgs>) {
  return async (...args: TArgs): Promise<Response> => {
    const requestId = createRequestId();
    return runWithRequestContext({ requestId }, async () => {
      const user = await getCurrentUser();

      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      return runWithRequestContext({ requestId, userId: user.id }, () => handler(user, ...args));
    });
  };
}
