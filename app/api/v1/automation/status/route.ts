import { NextResponse } from "next/server";
import { withUser } from "@/src/auth/api";
import { listAutomationStates } from "@/src/services/automationService";

export const GET = withUser(async (user) => NextResponse.json(await listAutomationStates(user.id)));
