import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type CalendarWriteDraft = {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  notes: string;
  operation: string;
  externalEventId: string | null;
};

export type CalendarWriteResult = { externalEventId: string | null };
export type CalendarCommandRunner = (args: string[]) => Promise<string>;

function findEventId(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  if ("event_id" in value && typeof value.event_id === "string") return value.event_id;
  for (const nested of Object.values(value)) {
    const found = findEventId(nested);
    if (found) return found;
  }
  return null;
}

export function parseLarkCalendarResult(stdout: string): string | null {
  const envelope = JSON.parse(stdout) as unknown;
  if (envelope && typeof envelope === "object" && "ok" in envelope && envelope.ok !== true) {
    throw new Error("Feishu calendar command did not succeed.");
  }
  return findEventId(envelope);
}

export async function runLarkCalendarCommand(args: string[]) {
  const command = process.env.HBM_LARK_CLI_PATH?.trim() || "lark-cli";
  try {
    const { stdout } = await execFileAsync(command, args, {
      env: {
        ...process.env,
        LARKSUITE_CLI_NO_UPDATE_NOTIFIER: "1",
        LARKSUITE_CLI_NO_SKILLS_NOTIFIER: "1"
      },
      maxBuffer: 1024 * 1024,
      timeout: 30_000
    });
    return stdout;
  } catch (error) {
    const stderr = error && typeof error === "object" && "stderr" in error ? String(error.stderr) : "";
    try {
      const envelope = JSON.parse(stderr) as { error?: { message?: string; hint?: string } };
      throw new Error(envelope.error?.message || envelope.error?.hint || "Feishu calendar command failed.");
    } catch (parseError) {
      if (parseError instanceof Error && parseError.message !== "Feishu calendar command failed.") throw parseError;
      throw new Error(error instanceof Error ? error.message : "Feishu calendar command failed.");
    }
  }
}

export async function writeCalendarDraft(
  draft: CalendarWriteDraft,
  runner: CalendarCommandRunner = runLarkCalendarCommand
): Promise<CalendarWriteResult> {
  const calendarId = process.env.HBM_LARK_CALENDAR_ID?.trim() || "primary";
  const common = ["--as", "user", "--format", "json"];

  if (draft.operation === "cancel") {
    if (!draft.externalEventId) throw new Error("Cancellation draft is missing an external event.");
    await runner([
      "calendar", "events", "delete",
      "--params", JSON.stringify({ calendar_id: calendarId, event_id: draft.externalEventId, need_notification: "true" }),
      ...common
    ]);
    return { externalEventId: null };
  }

  const eventFields = [
    "--summary", draft.title,
    "--description", draft.notes,
    "--start", draft.startsAt.toISOString(),
    "--end", draft.endsAt.toISOString(),
    "--calendar-id", calendarId,
    ...common
  ];

  if (draft.externalEventId) {
    await runner(["calendar", "+update", "--event-id", draft.externalEventId, ...eventFields]);
    return { externalEventId: draft.externalEventId };
  }

  const stdout = await runner(["calendar", "+create", ...eventFields]);
  const externalEventId = parseLarkCalendarResult(stdout);
  if (!externalEventId) throw new Error("Feishu calendar create response did not include an event ID.");
  return { externalEventId };
}
