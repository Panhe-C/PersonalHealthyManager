"use client";

import { useState } from "react";
import { CalendarCheck } from "lucide-react";
import { ActionButton } from "@/components/ActionButton";

type Draft = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  status: string;
};

export function CalendarDraftList({ drafts }: { drafts: Draft[] }) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  async function confirm(id: string) {
    setConfirmingId(id);
    const response = await fetch(`/api/calendar/drafts/${id}/confirm`, { method: "POST" });
    if (response.ok) {
      window.location.reload();
      return;
    }
    setConfirmingId(null);
  }

  return (
    <section className="surface panel">
      <div className="panel-heading">
        <div>
          <h2>Calendar drafts</h2>
          <p className="page-subtitle">Training events remain drafts until you confirm them.</p>
        </div>
      </div>
      {drafts.length === 0 ? (
        <div className="empty-state">No scheduled training drafts.</div>
      ) : (
        <div className="list">
          {drafts.map((draft) => (
            <div className="list-row" key={draft.id}>
              <div>
                <strong>{draft.title}</strong>
                <div className="task-meta">
                  {new Date(draft.startsAt).toLocaleString()} –{" "}
                  {new Date(draft.endsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
              <ActionButton
                type="button"
                onClick={() => confirm(draft.id)}
                disabled={draft.status !== "draft" || confirmingId !== null}
              >
                <CalendarCheck aria-hidden="true" size={16} />{" "}
                {draft.status === "draft" ? (confirmingId === draft.id ? "Confirming..." : "Confirm") : "Confirmed"}
              </ActionButton>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
