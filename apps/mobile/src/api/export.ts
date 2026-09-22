import { z } from "zod";
import { api } from "./client";

const exportSchema = z.object({ format: z.literal("healthy-body-manager-export"), version: z.number(), exportedAt: z.string() }).passthrough();
export function exportAccountData() { return api.get<Record<string, unknown>>("/account/export", exportSchema); }
