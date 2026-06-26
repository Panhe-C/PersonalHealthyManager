export type TaskSnapshot = {
  id: string;
  intensity: string;
  durationMinutes: number;
  title: string;
  date: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  status: string;
};

export type DraftSnapshot = {
  id: string;
  title: string;
  startsAt: string | null;
  endsAt: string | null;
  notes: string;
  status: string;
  failureReason: string | null;
};

export type ActionSnapshot = {
  tasks: TaskSnapshot[];
  drafts: DraftSnapshot[];
  planIds?: { superseded?: string; created?: string };
};

export type AffectedRows = {
  tasks: Array<{
    id: string;
    intensity: string;
    durationMinutes: number;
    title: string;
    date: Date | null;
    scheduledStart: Date | null;
    scheduledEnd: Date | null;
    status: string;
  }>;
  drafts: Array<{
    id: string;
    title: string;
    startsAt: Date | null;
    endsAt: Date | null;
    notes: string;
    status: string;
    failureReason: string | null;
  }>;
  planIds?: { superseded?: string; created?: string };
};

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function parseDate(value: string | null): Date | null {
  return value ? new Date(value) : null;
}

export function serializeSnapshot(rows: AffectedRows): ActionSnapshot {
  return {
    tasks: rows.tasks.map((task) => ({
      id: task.id,
      intensity: task.intensity,
      durationMinutes: task.durationMinutes,
      title: task.title,
      date: iso(task.date),
      scheduledStart: iso(task.scheduledStart),
      scheduledEnd: iso(task.scheduledEnd),
      status: task.status
    })),
    drafts: rows.drafts.map((draft) => ({
      id: draft.id,
      title: draft.title,
      startsAt: iso(draft.startsAt),
      endsAt: iso(draft.endsAt),
      notes: draft.notes,
      status: draft.status,
      failureReason: draft.failureReason
    })),
    planIds: rows.planIds
  };
}

export type RestoreStatements = {
  tasks: Array<{ id: string; data: Record<string, unknown> }>;
  drafts: Array<{ id: string; data: Record<string, unknown> }>;
};

export function restoreStatementsFromSnapshot(snapshot: ActionSnapshot): RestoreStatements {
  return {
    tasks: snapshot.tasks.map((task) => ({
      id: task.id,
      data: {
        intensity: task.intensity,
        durationMinutes: task.durationMinutes,
        title: task.title,
        date: parseDate(task.date),
        scheduledStart: parseDate(task.scheduledStart),
        scheduledEnd: parseDate(task.scheduledEnd),
        status: task.status
      }
    })),
    drafts: snapshot.drafts.map((draft) => ({
      id: draft.id,
      data: {
        title: draft.title,
        startsAt: parseDate(draft.startsAt),
        endsAt: parseDate(draft.endsAt),
        notes: draft.notes,
        status: draft.status,
        failureReason: draft.failureReason
      }
    }))
  };
}
