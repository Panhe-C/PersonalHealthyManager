"use client";

import clsx from "clsx";
import { useState } from "react";
import { CircleSlash2, Save } from "lucide-react";
import { ActionButton } from "@/components/ActionButton";

type ChecklistItem = {
  id: string;
  label: string;
  status: string;
};

type ActivityOption = {
  id: string;
  label: string;
};

export function Checklist({
  taskId,
  items,
  activities,
  readOnly
}: {
  taskId: string;
  items: ChecklistItem[];
  activities: ActivityOption[];
  readOnly: boolean;
}) {
  const [localItems, setLocalItems] = useState(items);
  const [actualMinutes, setActualMinutes] = useState("");
  const [perceivedEffort, setPerceivedEffort] = useState("");
  const [notes, setNotes] = useState("");
  const [linkedActivityId, setLinkedActivityId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function update(itemId: string, status: "pending" | "completed" | "skipped") {
    setLocalItems((current) => current.map((item) => (item.id === itemId ? { ...item, status } : item)));
  }

  async function saveCompletion() {
    setSaving(true);
    setError("");
    const response = await fetch(`/api/training/tasks/${taskId}/completion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actualLoad: actualMinutes ? Number(actualMinutes) : undefined,
        perceivedEffort: perceivedEffort || undefined,
        notes: notes || undefined,
        linkedActivityId: linkedActivityId || undefined,
        items: localItems.map((item) => ({
          id: item.id,
          label: item.label,
          status: item.status
        }))
      })
    });

    if (response.ok) {
      window.location.reload();
      return;
    }

    setSaving(false);
    setError("Training feedback could not be saved.");
  }

  return (
    <div className="checklist">
      {localItems.map((item) => (
        <div className="checklist-row" key={item.id}>
          <input
            aria-label={`Complete ${item.label}`}
            type="checkbox"
            checked={item.status === "completed"}
            disabled={readOnly || saving}
            onChange={(event) => update(item.id, event.target.checked ? "completed" : "pending")}
          />
          <span className={clsx("checklist-label", item.status === "completed" && "checklist-label-completed")}>{item.label}</span>
          {item.status === "skipped" ? <span className="status status-warn">Skipped</span> : null}
          <button
            aria-label={`Skip ${item.label}`}
            className="icon-button"
            title="Mark skipped"
            type="button"
            disabled={readOnly || saving}
            onClick={() => update(item.id, item.status === "skipped" ? "pending" : "skipped")}
          >
            <CircleSlash2 aria-hidden="true" size={16} />
          </button>
        </div>
      ))}

      {readOnly ? (
        <div className="message">Training feedback has been recorded.</div>
      ) : (
        <details className="completion-details">
          <summary>Completion details</summary>
          <div className="grid form-grid completion-grid">
            <label className="field">
              Actual minutes
              <input
                min="0"
                type="number"
                value={actualMinutes}
                onChange={(event) => setActualMinutes(event.target.value)}
              />
            </label>
            <label className="field">
              Perceived effort
              <select value={perceivedEffort} onChange={(event) => setPerceivedEffort(event.target.value)}>
                <option value="">Not specified</option>
                <option value="easy">Easy</option>
                <option value="moderate">Moderate</option>
                <option value="hard">Hard</option>
              </select>
            </label>
            <label className="field field-span">
              Linked COROS activity
              <select value={linkedActivityId} onChange={(event) => setLinkedActivityId(event.target.value)}>
                <option value="">None</option>
                {activities.map((activity) => (
                  <option key={activity.id} value={activity.id}>
                    {activity.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field field-span">
              Notes
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
            </label>
            <div className="field-span toolbar">
              <ActionButton type="button" onClick={saveCompletion} disabled={saving}>
                <Save aria-hidden="true" size={16} /> {saving ? "Saving..." : "Update training"}
              </ActionButton>
              {error ? <span className="message message-error">{error}</span> : null}
            </div>
          </div>
        </details>
      )}
    </div>
  );
}
