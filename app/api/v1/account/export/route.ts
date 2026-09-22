import { NextResponse } from "next/server";
import { withUser } from "@/src/auth/api";
import { exportUserData } from "@/src/services/dataExportService";

export const GET = withUser(async (user) => NextResponse.json(await exportUserData(user.id), {
  headers: { "Content-Disposition": `attachment; filename="healthy-body-manager-${new Date().toISOString().slice(0, 10)}.json"`, "Cache-Control": "no-store" }
}));
