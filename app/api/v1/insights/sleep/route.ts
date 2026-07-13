import { NextResponse } from "next/server";
import { withUser } from "@/src/auth/api";
import { prisma } from "@/src/db/client";
import { sinceQuerySchema } from "@/src/contracts";

export const GET = withUser(async (user, request: Request) => {
  const url = new URL(request.url);
  const parsed = sinceQuerySchema.safeParse({
    since: url.searchParams.get("since") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query parameters", code: "invalid_query" }, { status: 400 });
  }

  const since = parsed.data.since ? new Date(parsed.data.since) : undefined;
  if (since && Number.isNaN(since.getTime())) {
    return NextResponse.json({ error: "Invalid since datetime", code: "invalid_query" }, { status: 400 });
  }

  const records = await prisma.sleepRecord.findMany({
    where: { userId: user.id, ...(since ? { date: { gte: since } } : {}) },
    orderBy: { date: "desc" },
    take: parsed.data.limit ?? 50
  });

  return NextResponse.json(records);
});
